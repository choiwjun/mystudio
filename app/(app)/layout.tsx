import { AppHeader } from "@/components/AppHeader";
import { DepartmentNav } from "@/components/DepartmentNav";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Paperclip OS</div>
        <DepartmentNav />
      </aside>
      <main className="main">
        <AppHeader />
        {children}
      </main>
    </div>
  );
}
