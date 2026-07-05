"use client";

export function LogoutButton() {
  async function logout(): Promise<void> {
    await fetch("/api/auth/logout", {
      method: "POST",
    });
    window.location.assign("/login");
  }

  return (
    <button className="button" onClick={logout} type="button">
      로그아웃
    </button>
  );
}
