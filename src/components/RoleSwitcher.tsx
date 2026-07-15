"use client";

import { useEffect, useState } from "react";
import { ALL_ROLES } from "@/lib/auth/roles";

/**
 * Demo-only role switcher — writes the `pulse_role` cookie and reloads so
 * server-rendered gating reflects the chosen role. Production replaces this with
 * the signed-in Entra identity; role is never client-selectable.
 */
export default function RoleSwitcher() {
  const [current, setCurrent] = useState("ServiceManager");

  useEffect(() => {
    const c = document.cookie
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("pulse_role="))
      ?.split("=")[1];
    if (c) setCurrent(c);
  }, []);

  return (
    <div className="stack" style={{ gap: 4 }}>
      <span className="micro" style={{ letterSpacing: ".08em" }}>
        Viewing as
      </span>
      <select
        className="inp"
        style={{ padding: "6px 8px", fontSize: 12.5 }}
        value={current}
        onChange={(e) => {
          document.cookie = `pulse_role=${e.target.value}; path=/; max-age=31536000`;
          window.location.reload();
        }}
      >
        {ALL_ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </div>
  );
}
