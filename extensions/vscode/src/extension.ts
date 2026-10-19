import * as vscode from "vscode";

import { startActivityTracker } from "./activityTracker";
import { TOKEN_SECRET_KEY, validateToken } from "./token";

export function activate(context: vscode.ExtensionContext) {
  const connect = vscode.commands.registerCommand("nexo.connect", () => connectNexo(context));
  context.subscriptions.push(connect, startActivityTracker(context));
}

export function deactivate() {}

async function connectNexo(context: vscode.ExtensionContext) {
  const existing = await context.secrets.get(TOKEN_SECRET_KEY);
  if (existing) {
    const choice = await vscode.window.showInformationMessage(
      "Ya hay un token de Nexo guardado en este editor.",
      "Reemplazar",
      "Conservar",
    );
    if (choice !== "Reemplazar") {
      return;
    }
  }

  const token = await vscode.window.showInputBox({
    title: "Conectar Nexo IT·Fin",
    prompt: "Pega el token de Mi tiempo. Empieza por nxo_ y solo se muestra una vez en el portal.",
    placeHolder: "nxo_…",
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => validateToken(value),
  });

  if (!token) {
    return;
  }

  await context.secrets.store(TOKEN_SECRET_KEY, token.trim());
  void vscode.window.showInformationMessage(
    "Token guardado en este editor. Se usará cuando la extensión envíe la actividad.",
  );
}
