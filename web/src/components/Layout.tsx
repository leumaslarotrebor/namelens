import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const links = [["/", "Home"], ["/analyze", "Analyze"], ["/sources", "Sources"], ["/privacy", "Privacy"], ["/about", "About"]] as const;

export function Layout() {
  const main = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  useEffect(() => { main.current?.focus({ preventScroll: false }); window.scrollTo(0, 0); }, [pathname]);
  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); main.current?.focus(); }}>Skip to content</a>
      <header className="site-header">
        <div className="wrap">
          <NavLink to="/" className="brand" aria-label="NameLens home">Name<span>Lens</span></NavLink>
          <nav aria-label="Main">
            <ul>{links.map(([to, label]) => (
              <li key={to}><NavLink to={to} end={to === "/"}>{label}</NavLink></li>
            ))}</ul>
          </nav>
        </div>
      </header>
      <main id="main" ref={main} tabIndex={-1} className="wrap"><Outlet /></main>
      <footer className="site-footer">
        <div className="wrap"><p>NameLens is an independent portfolio project. It is not affiliated with Dublin City University or the MyNameIS project.</p></div>
      </footer>
    </>
  );
}
