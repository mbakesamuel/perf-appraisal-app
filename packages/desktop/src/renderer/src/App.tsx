import { useMemo, useState } from "react";
import type { FinancialYear, User } from "@perf-appraisal-app/shared";
import { setCurrentUserId } from "./api/client";
import { AppraisalConsole } from "./components/AppraisalConsole";
import { AppraisalSummaryConsole } from "./components/AppraisalSummaryConsole";
import { DecisionMatricConsole } from "./components/DecisionMatricConsole";
import { FinancialYearsConsole } from "./components/FinancialYearsConsole";
import { Footer } from "./components/Footer";
import { LetterCopiesConsole } from "./components/LetterCopiesConsole";
import { LettersConsole } from "./components/LettersConsole";
import { Login } from "./components/Login";
import type { Menu } from "./components/MenuBar";
import { OrganizationConsole } from "./components/OrganizationConsole";
import { RolesConsole } from "./components/RolesConsole";
import { SalaryReviewExportConsole } from "./components/SalaryReviewExportConsole";
import { SalaryReviewImportConsole } from "./components/SalaryReviewImportConsole";
import { ThroOfficersConsole } from "./components/ThroOfficersConsole";
import { TopNav } from "./components/TopNav";
import { ThemeToggle } from "./components/ThemeToggle";
import { UserFinancialYearConsole } from "./components/UserFinancialYearConsole";
import { UsersConsole } from "./components/UsersConsole";
import welcomeSrc from "./assets/welcome.jpg";

type View =
  | "home"
  | "appraisal-console"
  | "financial-years"
  | "import-salary-review"
  | "export-salary-review"
  | "open-financial-year"
  | "organization"
  | "decision-matric"
  | "thro-officers"
  | "letter-copies"
  | "users"
  | "roles"
  | "letters"
  | "appraisal-summary";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [financialYear, setFinancialYear] = useState<FinancialYear | null>(
    null,
  );
  const [view, setView] = useState<View>("home");

  function applyFinancialYear(
    next: FinancialYear | null,
    nextUser?: User,
  ) {
    setFinancialYear(next);
    if (nextUser) {
      setUser(nextUser);
    } else {
      setUser((prev) =>
        prev ? { ...prev, financialYearId: next?.id ?? null } : prev,
      );
    }
  }

  const menus: Menu[] = useMemo(() => {
    const perms = user?.permissions;
    const processItems = [
      ...(perms?.canFinancialYears
        ? [
            {
              label: "Financial Years",
              onSelect: () => setView("financial-years" as View),
            },
            {
              label: "Open Financial Year",
              onSelect: () => setView("open-financial-year" as View),
            },
          ]
        : [
            {
              label: "Open Financial Year",
              onSelect: () => setView("open-financial-year" as View),
            },
          ]),
      ...(perms?.canImportHistory
        ? [
            {
              label: "Import Appraisals (From Excel)",
              onSelect: () => setView("import-salary-review" as View),
            },
          ]
        : []),
      ...(perms?.canExportHistory
        ? [
            {
              label: "Export Appraisals (To Excel)",
              onSelect: () => setView("export-salary-review" as View),
            },
          ]
        : []),
      ...(perms?.canOrganization
        ? [
            {
              label: "Departments/Units/Section",
              onSelect: () => setView("organization" as View),
            },
          ]
        : []),
      ...(perms?.canLetterCc
        ? [
            {
              label: "Letter copies (CC)",
              onSelect: () => setView("letter-copies" as View),
            },
          ]
        : []),
      ...(perms?.canDecisionMatrix
        ? [
            {
              label: "Signature Matrix (Decision Matrix)",
              onSelect: () => setView("decision-matric" as View),
            },
          ]
        : []),
      ...(perms?.canThroughOfficers
        ? [
            {
              label: "Unit Hierarchy",
              onSelect: () => setView("thro-officers" as View),
            },
          ]
        : []),
      ...(perms?.canUsers
        ? [
            {
              label: "User Accounts",
              onSelect: () => setView("users" as View),
            },
          ]
        : []),
      ...(perms?.canRoles
        ? [
            {
              label: "Roles & Permissions",
              onSelect: () => setView("roles" as View),
            },
          ]
        : []),
    ];

    const operationItems = perms?.canAppraisals
      ? [
          {
            label: "Appraisal Console",
            onSelect: () => setView("appraisal-console" as View),
          },
        ]
      : [];

    const reportItems = perms?.canAppraisals
      ? [
          {
            label: "Appraisal Letters",
            onSelect: () => setView("letters" as View),
          },
          {
            label: "Appraisal Summary",
            onSelect: () => setView("appraisal-summary" as View),
          },
        ]
      : [];

    return [
      { label: "File", items: [] },
      ...(processItems.length > 0
        ? [{ label: "Parameters", items: processItems }]
        : []),
      ...(operationItems.length > 0
        ? [{ label: "Operations", items: operationItems }]
        : []),
      ...(reportItems.length > 0
        ? [{ label: "Reports", items: reportItems }]
        : []),
    ];
  }, [user?.permissions]);

  if (!user) {
    return (
      <main className="relative flex h-screen flex-col items-center justify-center gap-6 overflow-hidden bg-muted/40 px-4">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Perf Appraisal</h1>
          <p className="mt-1 text-muted-foreground">Sign in to continue.</p>
        </header>

        <Login
          onLogin={(nextUser, nextYear) => {
            setCurrentUserId(nextUser.id);
            setUser(nextUser);
            setFinancialYear(nextYear);
          }}
        />
      </main>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopNav
        user={user}
        financialYear={financialYear}
        menus={menus}
        onLogout={() => {
          setCurrentUserId(null);
          setUser(null);
          setFinancialYear(null);
          setView("home");
        }}
      />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {view === "appraisal-console" ? (
          <AppraisalConsole
            user={user}
            financialYear={financialYear}
            onClose={() => setView("home")}
          />
        ) : view === "financial-years" ? (
          <FinancialYearsConsole
            user={user}
            financialYear={financialYear}
            onFinancialYearChange={applyFinancialYear}
            onClose={() => setView("home")}
          />
        ) : view === "import-salary-review" ? (
          <SalaryReviewImportConsole onClose={() => setView("home")} />
        ) : view === "export-salary-review" ? (
          <SalaryReviewExportConsole
            user={user}
            onClose={() => setView("home")}
          />
        ) : view === "open-financial-year" ? (
          <UserFinancialYearConsole
            user={user}
            financialYear={financialYear}
            onFinancialYearChange={applyFinancialYear}
            onClose={() => setView("home")}
          />
        ) : view === "organization" ? (
          <OrganizationConsole
            currentUser={user}
            onClose={() => setView("home")}
          />
        ) : view === "decision-matric" ? (
          <DecisionMatricConsole onClose={() => setView("home")} />
        ) : view === "thro-officers" ? (
          <ThroOfficersConsole onClose={() => setView("home")} />
        ) : view === "letter-copies" ? (
          <LetterCopiesConsole onClose={() => setView("home")} />
        ) : view === "users" ? (
          <UsersConsole currentUser={user} onClose={() => setView("home")} />
        ) : view === "roles" ? (
          <RolesConsole onClose={() => setView("home")} />
        ) : view === "letters" ? (
          <LettersConsole
            user={user}
            financialYear={financialYear}
            onClose={() => setView("home")}
          />
        ) : view === "appraisal-summary" ? (
          <AppraisalSummaryConsole
            user={user}
            financialYear={financialYear}
            onClose={() => setView("home")}
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center px-6">
            <img
              src={welcomeSrc}
              alt=""
              className="max-h-[70vh] max-w-full object-contain"
            />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
