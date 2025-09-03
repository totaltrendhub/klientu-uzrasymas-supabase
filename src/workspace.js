import React, {createContext, useContext, useEffect, useState} from "react";
import { supabase } from "./supabaseClient";

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const [workspace, setWorkspace] = useState(() => {
    const id = localStorage.getItem("workspace_id");
    const name = localStorage.getItem("workspace_name") || "Darbo vieta";
    return id ? { id, name } : null;
  });
  const [plan, setPlan] = useState(localStorage.getItem("plan") || "free");

  useEffect(() => {
    (async () => {
      if (workspace?.id) return;
      try {
        const { data } = await supabase.from("workspaces").select("id,name").limit(1).maybeSingle();
        if (data?.id) {
          setWorkspace({ id: data.id, name: data.name || "Darbo vieta" });
          localStorage.setItem("workspace_id", data.id);
          localStorage.setItem("workspace_name", data.name || "Darbo vieta");
        }
      } catch {}
    })();
  }, [workspace?.id]);

  return (
    <WorkspaceContext.Provider value={{ workspace, setWorkspace, plan, setPlan }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
