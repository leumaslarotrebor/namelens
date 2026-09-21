import { HashRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { About } from "./pages/About";
import { Analyze } from "./pages/Analyze";
import { Home } from "./pages/Home";
import { Privacy } from "./pages/Privacy";
import { Sources } from "./pages/Sources";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="analyze" element={<Analyze />} />
        <Route path="sources" element={<Sources />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<><h1>Page not found</h1><p><a href="#/">Go to the home page</a></p></>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return <HashRouter><AppRoutes /></HashRouter>;
}
