// Help and documentation: how to use each screen (by role), common questions and, for the
// coordinator, the technical documentation (where each data structure is used).

import { useState } from "react";
import { api, API_URL } from "../api";
import { useCurrentUser } from "../auth";
import { ErrorBox, Loading, PageHeader } from "../components/Feedback";
import { useLoad } from "../hooks";
import type { RoleCode, TreeNode } from "../types";

interface Guide {
  title: string;
  steps: string[];
}

const GUIDES: Record<RoleCode, Guide[]> = {
  coordinator: [
    {
      title: "Preparar una sede nueva",
      steps: [
        "En Flota, toque «+ Nueva sede» y escriba el nombre y la vereda.",
        "Agregue los buses de esa sede (placa, marca, modelo y puestos).",
        "Cree en Usuarios a los conductores y registre su licencia indicando la sede donde trabajan.",
        "En Rutas, cree la ruta: al elegir la sede solo aparecen los buses de esa sede.",
      ],
    },
    {
      title: "Registrar un estudiante",
      steps: [
        "Cree primero al acudiente en Usuarios (rol Acudiente) si no existe.",
        "En Estudiantes, toque «Registrar estudiante», elija sede, ruta y parada.",
        "Agregue de 1 a 4 acudientes; si hay más de uno, marque cuál es el principal.",
        "Imprima el carnet con el código QR para que lo escaneen al subir al bus.",
      ],
    },
    {
      title: "Programar y seguir un recorrido",
      steps: [
        "En Recorridos elija la ruta: solo aparecen los conductores y buses de su sede.",
        "El conductor lo ve en su celular, elige clima y vía e inicia.",
        "Siga el bus en el mapa en tiempo real desde la lista de recorridos.",
      ],
    },
    {
      title: "Usar la inteligencia artificial",
      steps: [
        "En Inteligencia, elija ruta, clima (o detéctelo con el GPS) y estado de la vía.",
        "La IA estima el retraso con una regresión entrenada con los recorridos reales.",
        "Cada predicción queda guardada en el historial de la misma pantalla.",
      ],
    },
  ],
  driver: [
    {
      title: "Hacer el recorrido",
      steps: [
        "Antes de salir, elija el clima (o «Detectar clima con el GPS») y el estado de la vía.",
        "Toque «Iniciar recorrido»: los acudientes reciben un aviso y la IA calcula el posible retraso.",
        "Deje activado «Compartiendo la ubicación del bus» durante todo el recorrido.",
        "Escanee el carnet QR de cada estudiante al subir y al bajar.",
        "Si se equivoca, use «Deshacer» (pila): borra el último registro.",
        "Al llegar, toque «Finalizar recorrido».",
      ],
    },
  ],
  monitor: [
    {
      title: "Ayudar en el recorrido",
      steps: [
        "Abra el recorrido en curso de su ruta.",
        "Escanee el carnet QR de cada estudiante al subir y al bajar, o márquelo en la lista.",
        "Sin internet también funciona: los registros se envían solos al recuperar la señal.",
      ],
    },
  ],
  guardian: [
    {
      title: "Seguir a sus hijos",
      steps: [
        "En «Mis hijos» vea si su hijo está a bordo, ya llegó o no ha subido.",
        "Cuando el recorrido está en curso, vea el bus en el mapa y el tiempo estimado de llegada.",
        "En Avisos recibe cuándo sube, cuándo baja, si el bus se acerca, si hay retraso o si no abordó.",
      ],
    },
  ],
};

const FAQ = [
  {
    q: "¿Por qué el primer ingreso tarda?",
    a: "El servidor gratuito se apaga tras 15 minutos sin uso; la primera petición lo despierta en menos de un minuto.",
  },
  {
    q: "¿Cómo se protege la contraseña?",
    a: "Se cifra en el dispositivo (SHA-256) antes de enviarse y el servidor la guarda con PBKDF2. La sesión dura 30 minutos y la cuenta se bloquea tras 5 intentos fallidos.",
  },
  {
    q: "¿Qué avisos recibe un acudiente?",
    a: "Inicio del recorrido, posible retraso (predicción de la IA), bus cerca de la parada, subió, bajó y no subió al bus.",
  },
  {
    q: "¿Quién hizo cada cambio?",
    a: "Todo queda en la Auditoría con el usuario, la acción y la hora. Esos registros no se pueden editar desde la aplicación.",
  },
];

export function Help() {
  const user = useCurrentUser();
  const isCoordinator = user.role.code === "coordinator";
  const [tab, setTab] = useState<"guide" | "tech">("guide");

  return (
    <>
      <PageHeader title="Ayuda y documentación" />
      {isCoordinator && (
        <div className="segmented" role="tablist" aria-label="Secciones de ayuda">
          <button type="button" role="tab" aria-selected={tab === "guide"} className="segmented-item" onClick={() => setTab("guide")}>
            Guía de uso
          </button>
          <button type="button" role="tab" aria-selected={tab === "tech"} className="segmented-item" onClick={() => setTab("tech")}>
            Documentación técnica
          </button>
        </div>
      )}
      {tab === "guide" || !isCoordinator ? <UserGuide role={user.role.code} /> : <TechnicalDocs />}
    </>
  );
}

function UserGuide({ role }: { role: RoleCode }) {
  return (
    <>
      <div className="guide-grid">
        {GUIDES[role].map((guide) => (
          <article key={guide.title} className="panel guide">
            <h2>{guide.title}</h2>
            <ol>
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </article>
        ))}
      </div>
      <section className="panel">
        <h2>Preguntas frecuentes</h2>
        {FAQ.map((item) => (
          <details key={item.q} className="faq">
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </section>
    </>
  );
}

function TechnicalDocs() {
  const data = useLoad(async () => {
    const [structures, tree] = await Promise.all([api.structures(), api.schoolTree()]);
    return { structures, tree };
  }, []);

  if (data.loading && !data.data) return <Loading />;
  if (data.error || !data.data) return <ErrorBox message={data.error ?? "Error"} onRetry={data.reload} />;

  return (
    <>
      <p className="lead">
        Las estructuras de datos están implementadas a mano en el servidor (carpeta <code>app/structures</code>) y cada una
        resuelve una tarea real de la aplicación. La API completa está documentada en{" "}
        <a href={`${API_URL}/docs`} target="_blank" rel="noreferrer">
          Swagger
        </a>
        .
      </p>
      <div className="structure-grid">
        {data.data.structures.map((s) => (
          <article key={s.name} className="panel structure">
            <h3>{s.name}</h3>
            <p>{s.use}</p>
            <p className="muted small">
              <code>{s.file}</code> · {s.complexity}
            </p>
            <p className="small">
              <code>{s.endpoint}</code>
            </p>
          </article>
        ))}
      </div>
      <section className="panel">
        <h2>Árbol n-ario: institución → sede → grado → estudiantes</h2>
        <p className="muted">{data.data.tree.total_leaves} estudiantes (hojas del árbol).</p>
        <Tree node={data.data.tree.tree} />
      </section>
    </>
  );
}

function Tree({ node }: { node: TreeNode }) {
  return (
    <ul className="tree">
      <li>
        <span className={`tree-node tree-${node.data.type}`}>{node.name}</span>
        {node.children.length > 0 &&
          node.children.map((child) => <Tree key={`${child.data.type}-${child.data.id}-${child.name}`} node={child} />)}
      </li>
    </ul>
  );
}
