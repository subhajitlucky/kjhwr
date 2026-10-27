import { useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AppStateProvider } from "./context/AppState";
import { OverviewPage } from "./pages/Overview";
import { AccuracyPage } from "./pages/Accuracy";
import { RevisionsPage } from "./pages/Revisions";
import { MethodPage } from "./pages/Method";
import { EmptyState, Panel } from "./components/ui";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

function NotFoundPage() {
  return (
    <Panel eyebrow="404" title="That page is off the map" bodyClassName="p-0">
      <EmptyState
        title="Nothing here"
        body="The page you asked for does not exist. Return to the decision view."
      />
      <div className="border-t border-edge px-5 py-3 text-center">
        <Link to="/" className="text-[11px] text-acid hover:underline">
          Back to overview
        </Link>
      </div>
    </Panel>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <ScrollToTop />
      <AppShell>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/accuracy" element={<AccuracyPage />} />
          <Route path="/revisions" element={<RevisionsPage />} />
          <Route path="/method" element={<MethodPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </AppStateProvider>
  );
}
