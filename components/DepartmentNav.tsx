"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type MatchMode = "exact" | "prefix";

type SidebarNavItem = {
  readonly href: string;
  readonly label: string;
  readonly description: string;
  readonly match: MatchMode;
  readonly activePath?: string;
  readonly children?: readonly SidebarNavItem[];
};

const phase1SidebarDepartments: readonly SidebarNavItem[] = [
  {
    href: "/",
    label: "HQ 지휘실",
    description: "오늘 브리핑과 결정",
    match: "exact",
  },
  {
    href: "/hermes",
    label: "기회 발굴",
    description: "Hermes 리서치",
    match: "prefix",
  },
  {
    href: "/packages",
    label: "콘텐츠 제작",
    description: "블로그 원문과 검수",
    match: "prefix",
    children: [
      {
        href: "/packages",
        label: "블로그 콘텐츠",
        description: "네이버 블로그 초안",
        match: "prefix",
      },
      {
        href: "/packages#sns",
        activePath: "/packages",
        label: "SNS 변환",
        description: "인스타그램·스레드·X 준비",
        match: "prefix",
      },
    ],
  },
  {
    href: "/products",
    label: "제휴/어필리에이트 수익",
    description: "상품과 링크 관리",
    match: "prefix",
    children: [
      {
        href: "/products",
        label: "제휴 상품",
        description: "상품 등록과 가격 갱신",
        match: "prefix",
      },
      {
        href: "/products#links",
        activePath: "/products",
        label: "쇼핑커넥트 링크",
        description: "어필리에이트 링크 추적",
        match: "prefix",
      },
      {
        href: "/products#affiliate-links",
        activePath: "/products",
        label: "범용 제휴 링크",
        description: "쿠팡·무신사·올리브영",
        match: "prefix",
      },
      {
        href: "/products#accounts",
        activePath: "/products",
        label: "제휴 계정",
        description: "다계정 채널 관리",
        match: "prefix",
      },
    ],
  },
  {
    href: "/performance",
    label: "성과 기록",
    description: "조회, 클릭, 수익",
    match: "prefix",
  },
  {
    href: "/reports",
    label: "리포트",
    description: "일간·주간·월간 회고",
    match: "prefix",
    children: [
      {
        href: "/reports/daily",
        label: "일간 리포트",
        description: "오늘 운영 현황",
        match: "prefix",
      },
      {
        href: "/reports/weekly",
        label: "주간 리포트",
        description: "성과와 개선점",
        match: "prefix",
      },
      {
        href: "/reports/monthly",
        label: "월간 리포트",
        description: "수익 목표 추적",
        match: "prefix",
      },
    ],
  },
  {
    href: "/compliance",
    label: "컴플라이언스",
    description: "고지와 정책 검수",
    match: "prefix",
  },
  {
    href: "/memory",
    label: "회사 메모리",
    description: "성공 패턴 학습",
    match: "prefix",
  },
];

function isActivePath(pathname: string, item: SidebarNavItem): boolean {
  const activePath = item.activePath ?? item.href;
  switch (item.match) {
    case "exact":
      return pathname === activePath;
    case "prefix":
      return pathname === activePath || pathname.startsWith(`${activePath}/`);
  }
}

function NavigationLink({
  item,
  pathname,
  variant,
}: Readonly<{
  item: SidebarNavItem;
  pathname: string;
  variant: "primary" | "child";
}>) {
  return (
    <Link
      aria-current={isActivePath(pathname, item) ? "page" : undefined}
      className={variant === "primary" ? "nav-link" : "nav-link nav-link-child"}
      href={item.href}
    >
      <span className="nav-link-label">{item.label}</span>
      <span className="nav-link-description">{item.description}</span>
    </Link>
  );
}

export function DepartmentNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="업무 메뉴">
      <ul className="nav-list">
        {phase1SidebarDepartments.map((department) => (
          <li key={department.href}>
            <NavigationLink item={department} pathname={pathname} variant="primary" />
            {department.children === undefined ? null : (
              <ul className="nav-sublist">
                {department.children.map((child) => (
                  <li key={child.href}>
                    <NavigationLink item={child} pathname={pathname} variant="child" />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
