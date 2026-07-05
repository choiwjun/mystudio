"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const departments = [
  { href: "/", label: "HQ", match: "exact" },
  { href: "/hermes", label: "Hermes", match: "prefix" },
  { href: "/packages/demo", label: "Content Factory", match: "packages" },
  { href: "/products", label: "Revenue Desk", match: "prefix" },
  { href: "/compliance", label: "Compliance", match: "prefix" },
  { href: "/memory", label: "Company Memory", match: "prefix" },
  { href: "/performance", label: "Reports", match: "prefix" },
  { href: "/settings", label: "Settings", match: "prefix" },
] as const;

function isActivePath(pathname: string, department: (typeof departments)[number]): boolean {
  switch (department.match) {
    case "exact":
      return pathname === department.href;
    case "packages":
      return pathname.startsWith("/packages");
    case "prefix":
      return pathname === department.href || pathname.startsWith(`${department.href}/`);
  }
}

export function DepartmentNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Departments">
      <ul className="nav-list">
        {departments.map((department) => (
          <li key={department.href}>
            <Link
              aria-current={isActivePath(pathname, department) ? "page" : undefined}
              className="nav-link"
              href={department.href}
            >
              {department.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
