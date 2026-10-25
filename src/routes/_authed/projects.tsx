import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute } from "@tanstack/react-router";
import { GitBranch, Loader2, Pencil, Plus } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  Pagination,
  Panel,
  PortalShell,
  SearchField,
  SectionTitle,
  StateMessage,
  StatusDot,
} from "@/components/portal/PortalShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClientOptions } from "@/lib/api/clients";
import {
  useCreateProject,
  useProjectHoursThisMonth,
  useProjects,
  useSetProjectStatus,
  useUpdateProject,
  type ProjectFilters,
} from "@/lib/api/projects";
import { PAGE_SIZE } from "@/lib/api/utils";
import { formatHours, formatMoney } from "@/lib/format";

const projectSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  client_id: z.string().uuid("Selecciona un cliente."),
  hourly_rate: z
    .string()
    .trim()
    .min(1, "La tarifa por hora es obligatoria.")
    .transform(Number)
    .pipe(
      z
        .number({ invalid_type_error: "La tarifa debe ser un número." })
        .positive("La tarifa por hora debe ser mayor a 0."),
    ),
  repository_url: z.string().trim().min(1, "La URL del repositorio es obligatoria."),
});

type ProjectForm = z.input<typeof projectSchema>;

const EMPTY_FORM: ProjectForm = { name: "", client_id: "", hourly_rate: "", repository_url: "" };

export const Route = createFileRoute("/_authed/projects")({
  head: () => ({
    meta: [
      { title: "Proyectos — Nexo IT·Fin" },
      {
        name: "description",
        content:
          "Administración de proyectos con URL de repositorio, cliente asociado y tarifa por hora.",
      },
      { property: "og:title", content: "Proyectos — Nexo IT·Fin" },
      {
        property: "og:description",
        content: "Tabla de proyectos para enlazar telemetría del IDE con tarifas de facturación.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectsPage,
});

function FieldError({ message }: { message: string | undefined }) {
  return message ? <p className="text-xs text-rosec">{message}</p> : null;
}

type EditableProject = {
  id: string;
  name: string;
  client_id: string;
  hourly_rate: number;
  repository_url: string;
};

function ProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: EditableProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const clients = useClientOptions(Boolean(project));
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const form = useForm<ProjectForm, unknown, z.output<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: EMPTY_FORM,
  });
  const { errors } = form.formState;
  const selectedClient = clients.data?.find((c) => c.id === form.watch("client_id"));
  const pending = createProject.isPending || updateProject.isPending;

  useEffect(() => {
    if (!open) return;
    form.reset(
      project
        ? {
            name: project.name,
            client_id: project.client_id,
            hourly_rate: String(project.hourly_rate),
            repository_url: project.repository_url,
          }
        : EMPTY_FORM,
    );
  }, [open, project, form]);

  const onSubmit = form.handleSubmit((values) => {
    const done = {
      onSuccess: () => {
        toast.success(
          project ? `Proyecto ${values.name} actualizado.` : `Proyecto ${values.name} creado.`,
        );
        onOpenChange(false);
      },
      onError: (error: Error) => toast.error(error.message),
    };
    if (project) updateProject.mutate({ id: project.id, values }, done);
    else createProject.mutate(values, done);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? "Editar proyecto" : "Nuevo Proyecto"}</DialogTitle>
          <DialogDescription>
            La URL del repositorio enlaza el tiempo automático con este proyecto. El tiempo ya
            facturado permanece en su factura.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 py-2" onSubmit={(event) => void onSubmit(event)} noValidate>
          <div className="space-y-2">
            <Label htmlFor={project ? "edit-project-name" : "project-name"}>Nombre</Label>
            <Input
              id={project ? "edit-project-name" : "project-name"}
              placeholder="billing-core"
              {...form.register("name")}
            />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Controller
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.data?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} · {client.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.client_id?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={project ? "edit-rate" : "rate"}>
              Tarifa por hora{selectedClient ? ` (${selectedClient.currency})` : ""}
            </Label>
            <Input
              id={project ? "edit-rate" : "rate"}
              type="number"
              min="0"
              step="0.01"
              placeholder="125"
              {...form.register("hourly_rate")}
            />
            <FieldError message={errors.hourly_rate?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={project ? "edit-repo" : "repo"}>URL del repositorio</Label>
            <Input
              id={project ? "edit-repo" : "repo"}
              placeholder="github.com/nexo/billing-core"
              {...form.register("repository_url")}
            />
            <FieldError message={errors.repository_url?.message} />
          </div>
          <DialogFooter>
            <Button type="submit" variant="clay" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Guardar proyecto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProjectFilters["status"]>("Active");
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EditableProject | null>(null);
  const deferredSearch = useDeferredValue(search);
  const projects = useProjects({ search: deferredSearch, status, page });
  const monthHours = useProjectHoursThisMonth();
  const setProjectStatus = useSetProjectStatus();

  return (
    <PortalShell
      active="/projects"
      title="Proyectos"
      subtitle="Repositorio, cliente y tarifa por hora"
      action={
        <Button variant="clay" size="sm" onClick={() => setCreating(true)}>
          <Plus />
          Nuevo Proyecto
        </Button>
      }
    >
      <ProjectDialog project={null} open={creating} onOpenChange={setCreating} />
      <ProjectDialog
        project={editing}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
      <Panel className="mb-16 md:mb-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle
            title="Gestión de Proyectos"
            subtitle="Sin tareas ni tickets; el tiempo se liga al proyecto"
          />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <SearchField
              placeholder="Buscar proyecto o repo"
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(0);
              }}
            />
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as ProjectFilters["status"]);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Activos</SelectItem>
                <SelectItem value="Inactive">Inactivos</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-background font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Proyecto</th>
                <th className="px-3 py-2.5 font-medium">Cliente</th>
                <th className="px-3 py-2.5 font-medium">Repositorio</th>
                <th className="px-3 py-2.5 font-medium">Tarifa</th>
                <th className="px-3 py-2.5 font-medium">Estado</th>
                <th className="px-3 py-2.5 text-right font-medium">Mes</th>
                <th className="px-3 py-2.5 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {projects.data?.rows.map((project) => {
                const isActive = project.status === "Active";
                return (
                  <tr key={project.id} className="hover:bg-clay-soft/40">
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-2 text-xs font-bold">
                        <GitBranch className="size-4 text-clay" />
                        {project.name}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs">{project.clients?.name}</td>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                      {project.repository_url}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs font-bold">
                      {formatMoney(project.hourly_rate, project.clients?.currency ?? "USD")}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <StatusDot tone={isActive ? "accent" : "rose"} />
                        {isActive ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs font-bold">
                      {formatHours(monthHours.data?.get(project.id))}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setEditing({
                              id: project.id,
                              name: project.name,
                              client_id: project.client_id,
                              hourly_rate: project.hourly_rate,
                              repository_url: project.repository_url,
                            })
                          }
                        >
                          <Pencil />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={setProjectStatus.isPending}
                          onClick={() =>
                            setProjectStatus.mutate(
                              { id: project.id, status: isActive ? "Inactive" : "Active" },
                              { onError: (error) => toast.error(error.message) },
                            )
                          }
                        >
                          {isActive ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {projects.isLoading ? <StateMessage>Cargando proyectos…</StateMessage> : null}
          {projects.error ? (
            <StateMessage tone="error">No se pudieron cargar los proyectos.</StateMessage>
          ) : null}
          {projects.data?.rows.length === 0 ? (
            <StateMessage>No hay proyectos que coincidan.</StateMessage>
          ) : null}
        </div>
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={projects.data?.total ?? 0}
          onPageChange={setPage}
        />
      </Panel>
    </PortalShell>
  );
}
