import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function Shell({
  title,
  actions,
  children,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <Header title={title} actions={actions} />
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
