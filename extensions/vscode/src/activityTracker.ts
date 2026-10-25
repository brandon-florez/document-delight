import * as vscode from "vscode";

import { originUrl } from "./repository";
import { TOKEN_SECRET_KEY } from "./token";

const INTERVAL_MS = 45_000;
const IDLE_MS = 3 * 60_000;
const DEFAULT_HEARTBEAT_URL =
  "https://tamihgvrooapgnwzbwhv.supabase.co/functions/v1/heartbeat";

type SendResult = {
  status: number;
  detail: string;
};

export function startActivityTracker(context: vscode.ExtensionContext): vscode.Disposable {
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusItem.command = "nexo.connect";
  statusItem.show();

  let typedSinceSend = false;
  let lastTypingAt = 0;
  // First keystroke of the current block. The portal opens a block at the
  // timestamp it receives, so the opening notice must carry this moment.
  let blockStartedAt: number | null = null;
  let blockAnchored = false;
  let anchoredRepo: string | null = null;
  let sending = false;
  let lastPopup = "";
  const originCache = new Map<string, { url: string | undefined; at: number }>();

  const setStatus = (text: string, tooltip: string) => {
    statusItem.text = `$(pulse) ${text}`;
    statusItem.tooltip = tooltip;
  };

  const popupOnce = (message: string, kind: "info" | "warning") => {
    if (message === lastPopup) {
      return;
    }
    lastPopup = message;
    if (kind === "warning") {
      void vscode.window.showWarningMessage(message);
    } else {
      void vscode.window.showInformationMessage(message);
    }
  };

  const onDocumentChange = (event: vscode.TextDocumentChangeEvent) => {
    if (event.document.uri.scheme !== "file" || event.contentChanges.length === 0) {
      return;
    }
    const now = Date.now();
    const gap = blockStartedAt === null || now - lastTypingAt > IDLE_MS;
    if (gap) {
      blockStartedAt = now;
      blockAnchored = false;
      anchoredRepo = null;
    }
    typedSinceSend = true;
    lastTypingAt = now;
  };

  const tick = () => {
    void sendIfActive();
  };

  async function sendIfActive() {
    if (sending) {
      return;
    }
    if (!vscode.window.state.focused) {
      setStatus("Nexo en pausa", "La ventana no está activa, así que no se envía actividad.");
      return;
    }
    if (!typedSinceSend || Date.now() - lastTypingAt > IDLE_MS) {
      typedSinceSend = false;
      if (Date.now() - lastTypingAt > IDLE_MS) {
        blockStartedAt = null;
        blockAnchored = false;
        anchoredRepo = null;
      }
      setStatus("Nexo en espera", "Se enviará actividad cuando escribas en un archivo.");
      return;
    }

    const token = await context.secrets.get(TOKEN_SECRET_KEY);
    if (!token) {
      setStatus("Nexo sin token", "Ejecuta «Nexo: conectar» y pega el token de Mi tiempo.");
      return;
    }

    const folder = activeFolder();
    if (!folder) {
      setStatus("Nexo sin carpeta", "Abre la carpeta del repositorio para poder medir el tiempo.");
      return;
    }

    const repositoryUrl = await cachedOrigin(folder);
    if (!repositoryUrl) {
      setStatus(
        "Nexo sin remoto",
        "Esta carpeta no tiene un remoto origin. El portal asocia el tiempo por esa URL.",
      );
      return;
    }

    const typedAtSend = lastTypingAt;
    const startedAt = blockStartedAt ?? typedAtSend;
    const opening = !blockAnchored || anchoredRepo !== repositoryUrl;
    sending = true;
    try {
      if (opening && typedAtSend - startedAt >= 1000) {
        const opened = await postHeartbeat(token, repositoryUrl, startedAt);
        if (opened.status !== 204) {
          applyResult(opened, typedAtSend);
          return;
        }
        blockAnchored = true;
        anchoredRepo = repositoryUrl;
      }
      const result = await postHeartbeat(token, repositoryUrl, Date.now());
      if (result.status === 204) {
        blockAnchored = true;
        anchoredRepo = repositoryUrl;
        if (opening) blockStartedAt = startedAt;
      }
      applyResult(result, typedAtSend);
    } catch {
      setStatus("Nexo sin conexión", "No se pudo contactar al portal. Se reintentará en el siguiente ciclo.");
    } finally {
      sending = false;
    }
  }

  function acknowledgeSend(typedAtSend: number) {
    if (lastTypingAt === typedAtSend) {
      typedSinceSend = false;
    }
  }

  function applyResult(result: SendResult, typedAtSend: number) {
    if (result.status === 204) {
      acknowledgeSend(typedAtSend);
      lastPopup = "";
      setStatus("Nexo sincronizado", "El portal registró la actividad de este repositorio.");
      return;
    }
    if (result.status === 202) {
      acknowledgeSend(typedAtSend);
      setStatus("Nexo: repo no registrado", result.detail);
      popupOnce(result.detail, "warning");
      return;
    }
    if (result.status === 401) {
      acknowledgeSend(typedAtSend);
      setStatus("Nexo: token rechazado", result.detail);
      popupOnce(result.detail, "warning");
      return;
    }
    if (result.status === 422) {
      acknowledgeSend(typedAtSend);
      setStatus("Nexo: aviso rechazado", result.detail);
      popupOnce(result.detail, "warning");
      return;
    }
    setStatus("Nexo: error del portal", result.detail);
  }

  async function cachedOrigin(folder: string): Promise<string | undefined> {
    const cached = originCache.get(folder);
    if (cached && Date.now() - cached.at < 60_000) {
      return cached.url;
    }
    const url = await originUrl(folder);
    originCache.set(folder, { url, at: Date.now() });
    return url;
  }

  setStatus("Nexo en espera", "Se enviará actividad cuando escribas en un archivo.");

  const changeSubscription = vscode.workspace.onDidChangeTextDocument(onDocumentChange);
  const timer = setInterval(tick, INTERVAL_MS);

  return vscode.Disposable.from(statusItem, changeSubscription, {
    dispose: () => clearInterval(timer),
  });
}

function activeFolder(): string | undefined {
  const document = vscode.window.activeTextEditor?.document;
  if (document) {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (folder) {
      return folder.uri.fsPath;
    }
  }
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function heartbeatUrl(): string {
  const configured = vscode.workspace.getConfiguration("nexo").get<string>("heartbeatUrl")?.trim();
  return configured || DEFAULT_HEARTBEAT_URL;
}

async function postHeartbeat(
  token: string,
  repositoryUrl: string,
  timestamp: number,
): Promise<SendResult> {
  const response = await fetch(heartbeatUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: null,
      repositoryUrl,
      timestamp: new Date(timestamp).toISOString(),
      isTyping: true,
    }),
  });

  if (response.status === 204) {
    return { status: 204, detail: "" };
  }

  const detail = await readDetail(response);
  if (response.status === 202) {
    return { status: 202, detail: detail || "El repositorio no pertenece a un proyecto activo." };
  }
  if (response.status === 401) {
    return { status: 401, detail: detail || "El token no es válido o fue revocado. Genera otro en Mi tiempo." };
  }
  if (response.status === 422) {
    return { status: 422, detail: detail || "El portal rechazó el aviso de actividad." };
  }
  return { status: response.status, detail: detail || "El portal no pudo registrar la actividad." };
}

async function readDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string; reason?: string; title?: string };
    return body.detail || body.reason || body.title || "";
  } catch {
    return "";
  }
}
