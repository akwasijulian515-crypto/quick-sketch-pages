import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getNeonAccessToken } from "@/auth/client";
import { SchoolShell } from "@/components/school-shell";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  MoreHorizontal,
  X,
  GraduationCap,
  CalendarDays,
  Phone,
  MapPin,
  Heart,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
} from "lucide-react";

type StudentStatus = "Active" | "Inactive";

type Student = {
  id: string;
  name: string;
  studentId: string;
  className: string;
  status: StudentStatus;
  dob: string;
  gender: string;
  guardian: string;
  phone: string;
  address: string;
  emergencyContact: string;
  medicalNote: string;
  guardianRelationship: string;
};

type StudentRecord = {
  id: string;
  first_name: string;
  last_name: string;
  student_id_number: string;
  status: string;
  class_name: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  medical_notes?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  guardian_relationship?: string | null;
};

type ClassOption = {
  id: string;
  name: string;
  academic_year_name?: string | null;
};

type AdmissionInput = {
  full_name: string;
  class_id: string | null;
  date_of_birth: string;
  gender: string;
  address: string;
  emergency_contact: string;
  medical_notes: string;
  guardian: { full_name: string; phone: string; email?: string; relationship?: string };
};

type BulkAdmissionRow = {
  rowNumber: number;
  input: AdmissionInput & { first_name: string; last_name: string; student_id_number: string };
};

type BulkAdmissionOutcome = { rowNumber: number; error?: string };

const csvHeaders = ["first_name", "last_name"] as const;

async function schoolApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getNeonAccessToken();
  const url = new URL(path, window.location.origin);
  const tenant =
    new URLSearchParams(window.location.search).get("tenant") ??
    sessionStorage.getItem("hg-school");
  if (tenant && !url.searchParams.has("tenant")) url.searchParams.set("tenant", tenant);
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${url.pathname}${url.search}`, { ...init, headers });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

function mapStudent(record: StudentRecord): Student {
  const dob = record.date_of_birth?.slice(0, 10) ?? "";
  return {
    id: record.id,
    name: `${record.first_name} ${record.last_name}`.trim(),
    studentId: record.student_id_number,
    className: record.class_name ?? "Unassigned",
    status: record.status.toLowerCase() === "active" ? "Active" : "Inactive",
    dob,
    gender: record.gender ?? "",
    guardian: record.guardian_name ?? "",
    phone: record.guardian_phone ?? "",
    address: record.address ?? "",
    emergencyContact: record.emergency_contact ?? "",
    medicalNote: record.medical_notes ?? "",
    guardianRelationship: record.guardian_relationship ?? "",
  };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === "," || character === "\n" || character === "\r") {
      if (character === ",") {
        row.push(cell);
        cell = "";
        closedQuote = false;
      } else {
        row.push(cell);
        if (row.some((value) => value.trim())) rows.push(row);
        row = [];
        cell = "";
        closedQuote = false;
        if (character === "\r" && text[index + 1] === "\n") index += 1;
      }
      continue;
    }

    if (character === '"') {
      if (cell.length || closedQuote)
        throw new Error("The CSV contains a misplaced quotation mark.");
      quoted = true;
      continue;
    }

    if (closedQuote) {
      if (!/\s/.test(character)) throw new Error("Unexpected text after a quoted CSV field.");
      continue;
    }
    cell += character;
  }

  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseBulkAdmissionRows(text: string): { rows: BulkAdmissionRow[]; errors: string[] } {
  const parsed = parseCsv(text.replace(/^\uFEFF/, ""));
  if (!parsed.length) throw new Error("The CSV file is empty.");

  const headers = parsed[0]!.map((header) => header.trim().toLowerCase());
  if (new Set(headers).size !== headers.length)
    throw new Error("The CSV contains duplicate column names.");
  const requiredHeaders = ["first_name", "last_name"];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length)
    throw new Error(`Missing required columns: ${missingHeaders.join(", ")}.`);

  const headerIndexes = new Map(headers.map((header, index) => [header, index]));
  const rows: BulkAdmissionRow[] = [];
  const errors: string[] = [];

  if (parsed.length - 1 > 200) throw new Error("A CSV can contain at most 200 student rows.");

  parsed.slice(1).forEach((values, index) => {
    const rowNumber = index + 2;
    const value = (header: string) => values[headerIndexes.get(header) ?? -1]?.trim() ?? "";
    if (values.length > headers.length) {
      errors.push(`Row ${rowNumber}: contains more values than the header.`);
      return;
    }

    const firstName = value("first_name");
    const lastName = value("last_name");
    if (!firstName || !lastName) {
      errors.push(`Row ${rowNumber}: first name and last name are required.`);
      return;
    }

    const fullName = `${firstName} ${lastName}`;
    rows.push({
      rowNumber,
      input: {
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        student_id_number: "",
        class_id: null,
        date_of_birth: "",
        gender: "",
        address: "",
        emergency_contact: "",
        medical_notes: "",
        guardian: { full_name: "", phone: "" },
      },
    });
  });

  return { rows, errors };
}

const tabs = ["All Students", "By Class", "Attendance", "Admissions"] as const;

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [query, setQuery] = useState("");
  const [filterClassId, setFilterClassId] = useState("");
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("All Students");
  const [loading, setLoading] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [listError, setListError] = useState("");
  const [classError, setClassError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const [showAdmission, setShowAdmission] = useState(false);
  const [showBulkAdmission, setShowBulkAdmission] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedProfileTab, setSelectedProfileTab] = useState<"Overview" | "Fees">("Overview");
  const [notice, setNotice] = useState("");
  const [canManageStudents, setCanManageStudents] = useState(false);

  useEffect(() => {
    setCanManageStudents(sessionStorage.getItem("hg-role") === "school_admin");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingClasses(true);
    schoolApi<{ classes: ClassOption[] }>("/api/school/classes")
      .then((result) => {
        if (!cancelled) {
          setClasses(result.classes);
          setClassError("");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setClassError(error instanceof Error ? error.message : "Could not load classes");
      })
      .finally(() => {
        if (!cancelled) setLoadingClasses(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), page_size: "50" });
      if (query.trim()) params.set("search", query.trim());
      if (filterClassId) params.set("class_id", filterClassId);
      schoolApi<{ students: StudentRecord[]; total: number }>(
        `/api/school/students?${params.toString()}`,
      )
        .then((result) => {
          if (cancelled) return;
          const mapped = result.students.map(mapStudent);
          setStudents((current) => (page === 1 ? mapped : [...current, ...mapped]));
          setTotal(result.total);
          setListError("");
        })
        .catch((error: unknown) => {
          if (!cancelled)
            setListError(error instanceof Error ? error.message : "Could not load students");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [filterClassId, page, query, reloadCount]);

  async function admitStudent(input: AdmissionInput) {
    const result = await schoolApi<{ student: StudentRecord }>("/api/school/students", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const created = mapStudent(result.student);
    setStudents([created]);
    setTotal(1);
    setPage(1);
    setQuery("");
    setFilterClassId("");
    setNotice(`${created.name} was admitted successfully.`);
    setShowAdmission(false);
  }

  async function importStudents(rows: BulkAdmissionRow[]): Promise<BulkAdmissionOutcome[]> {
    const outcomes: BulkAdmissionOutcome[] = new Array(rows.length);
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < rows.length) {
        const index = nextIndex;
        nextIndex += 1;
        const item = rows[index];
        if (!item) continue;
        try {
          await schoolApi<{ student: StudentRecord }>("/api/school/students", {
            method: "POST",
            body: JSON.stringify(item.input),
          });
          outcomes[index] = { rowNumber: item.rowNumber };
        } catch (cause) {
          outcomes[index] = {
            rowNumber: item.rowNumber,
            error: cause instanceof Error ? cause.message : "Could not save this student",
          };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, rows.length) }, worker));
    const imported = outcomes.filter((outcome) => !outcome.error).length;
    setNotice(
      `Imported ${imported} student${imported === 1 ? "" : "s"}. Review the CSV import report for any skipped rows.`,
    );
    setPage(1);
    setReloadCount((count) => count + 1);
    return outcomes;
  }

  return (
    <SchoolShell title="Students" schoolAdmin>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Students</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage student records and admissions
            </p>
          </div>
          <button
            onClick={() => setShowAdmission(true)}
            className="admin-btn-primary flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> Admit Student
          </button>
          {canManageStudents && (
            <button
              onClick={() => setShowBulkAdmission(true)}
              className="admin-btn-secondary flex items-center gap-2"
            >
              <Upload className="w-4 h-4" /> Import CSV
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={Users}
            label="Student records"
            value={loading && total === 0 ? "—" : String(total)}
            note="Matching this search"
          />
          <StatCard
            icon={GraduationCap}
            label="Classes"
            value={loadingClasses ? "—" : String(classes.length)}
            note="Available in this school"
          />
          <StatCard icon={CalendarDays} label="New this term" value="—" note="Not tracked yet" />
        </div>

        {notice && (
          <div
            role="status"
            className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground"
          >
            <div className="flex items-center justify-between gap-3">
              <span>{notice}</span>
              <button onClick={() => setNotice("")} aria-label="Dismiss confirmation">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        {classError && (
          <p role="alert" className="text-sm text-destructive">
            {classError}
          </p>
        )}

        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => {
                setPage(1);
                setQuery(event.target.value);
              }}
              placeholder="Search by name or student ID..."
              className="admin-input pl-10"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={filterClassId}
              onChange={(event) => {
                setPage(1);
                setFilterClassId(event.target.value);
              }}
              className="admin-input pl-10 pr-8 appearance-none min-w-[160px]"
            >
              <option value="">All Classes</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {activeTab === "All Students" || activeTab === "By Class" ? (
          <div className="admin-card overflow-hidden">
            {listError ? (
              <div role="alert" className="p-8 text-center">
                <p className="text-sm text-destructive">{listError}</p>
                <button
                  className="admin-btn-secondary mt-3"
                  onClick={() => {
                    setPage(1);
                    setReloadCount((count) => count + 1);
                  }}
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                          Student
                        </th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                          Student ID
                        </th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                          Class
                        </th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                          Attendance
                        </th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                          Status
                        </th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr
                          key={student.id}
                          className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedProfileTab("Overview");
                            setSelectedStudent(student);
                          }}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                {student.name
                                  .split(" ")
                                  .map((part) => part[0])
                                  .slice(0, 2)
                                  .join("")}
                              </div>
                              <span className="font-medium text-foreground">{student.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                            {student.studentId}
                          </td>
                          <td className="px-5 py-3.5 text-foreground">{student.className}</td>
                          <td className="px-5 py-3.5 text-muted-foreground">Not connected</td>
                          <td className="px-5 py-3.5">
                            <StatusBadge status={student.status} />
                          </td>
                          <td className="px-3 py-3.5">
                            <button
                              type="button"
                              aria-label={`Open fees for ${student.name}`}
                              title={`Open ${student.name}'s fee history`}
                              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedProfileTab("Fees");
                                setSelectedStudent(student);
                              }}
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!loading && students.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                            {query.trim() || filterClassId
                              ? "No students match these filters."
                              : "No student records yet. Admit a student to get started."}
                          </td>
                        </tr>
                      )}
                      {loading && students.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                            Loading student records…
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {students.length < total && !loading && (
                  <div className="p-4 border-t border-border text-center">
                    <button
                      className="admin-btn-secondary"
                      onClick={() => setPage((current) => current + 1)}
                    >
                      Load more students
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : activeTab === "Admissions" ? (
          <div className="admin-card p-8 text-center">
            <UserPlus className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-semibold text-foreground">Admissions</h2>
            <p className="text-sm text-muted-foreground mt-1">
              New admissions are saved to this school’s student records.
            </p>
            <button onClick={() => setShowAdmission(true)} className="admin-btn-primary mt-4">
              Admit Student
            </button>
          </div>
        ) : (
          <div className="admin-card p-8 text-center">
            <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-semibold text-foreground">Attendance records</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Student attendance summaries are not connected to this view yet.
            </p>
          </div>
        )}

        {showAdmission && (
          <AdmissionModal
            classes={classes}
            loadingClasses={loadingClasses}
            onClose={() => setShowAdmission(false)}
            onSubmit={admitStudent}
          />
        )}
        {showBulkAdmission && (
          <BulkAdmissionModal
            classes={classes}
            loadingClasses={loadingClasses}
            onClose={() => setShowBulkAdmission(false)}
            onImport={importStudents}
          />
        )}
        {selectedStudent && (
          <StudentProfile
            key={selectedStudent.id}
            student={selectedStudent}
            initialTab={selectedProfileTab}
            canManageStudents={canManageStudents}
            onStatusChange={(studentId, status) => {
              setStudents((current) =>
                current.map((item) => (item.id === studentId ? { ...item, status } : item)),
              );
              setSelectedStudent((current) =>
                current?.id === studentId ? { ...current, status } : current,
              );
            }}
            onClose={() => setSelectedStudent(null)}
          />
        )}
      </div>
    </SchoolShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="admin-card p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold font-display text-foreground mt-0.5">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{note}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: StudentStatus }) {
  const colors =
    status === "Active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${colors}`}>{status}</span>
  );
}

function AdmissionModal({
  classes,
  loadingClasses,
  onClose,
  onSubmit,
}: {
  classes: ClassOption[];
  loadingClasses: boolean;
  onClose: () => void;
  onSubmit: (input: AdmissionInput) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const data = new FormData(event.currentTarget);
    const guardianPhone = String(data.get("guardianPhone") ?? "").trim();
    try {
      await onSubmit({
        full_name: String(data.get("name") ?? "").trim(),
        class_id: String(data.get("classId") ?? ""),
        date_of_birth: String(data.get("dob") ?? ""),
        gender: String(data.get("gender") ?? ""),
        address: String(data.get("address") ?? "").trim(),
        emergency_contact: String(data.get("emergency") ?? "").trim(),
        medical_notes: String(data.get("medical") ?? "").trim(),
        guardian: { full_name: String(data.get("guardian") ?? "").trim(), phone: guardianPhone },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this student");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Admit New Student</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Student and guardian details are saved to this school
            </p>
          </div>
          <button onClick={onClose} aria-label="Close admission form">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <form className="p-6 space-y-4" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="admin-label">Full Name</label>
              <input name="name" required className="admin-input" placeholder="e.g. Ama Mensah" />
            </div>
            <div>
              <label className="admin-label">Class</label>
              <select
                name="classId"
                required
                disabled={loadingClasses || classes.length === 0}
                className="admin-input"
              >
                <option value="">
                  {loadingClasses
                    ? "Loading classes…"
                    : classes.length
                      ? "Select a class"
                      : "No classes available"}
                </option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.academic_year_name ? ` · ${item.academic_year_name}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="admin-label">Date of Birth</label>
              <input name="dob" type="date" className="admin-input" />
            </div>
            <div>
              <label className="admin-label">Gender</label>
              <select name="gender" className="admin-input">
                <option value="">Select</option>
                <option>Male</option>
                <option>Female</option>
              </select>
            </div>
            <div>
              <label className="admin-label">Guardian Name</label>
              <input name="guardian" className="admin-input" placeholder="Parent/guardian" />
            </div>
            <div>
              <label className="admin-label">Guardian Phone</label>
              <input name="guardianPhone" className="admin-input" placeholder="024 000 0000" />
            </div>
            <div className="col-span-2">
              <label className="admin-label">Address</label>
              <input name="address" className="admin-input" placeholder="Residential address" />
            </div>
            <div>
              <label className="admin-label">Emergency Contact</label>
              <input name="emergency" className="admin-input" placeholder="Phone number" />
            </div>
            <div>
              <label className="admin-label">Medical Notes</label>
              <input
                name="medical"
                className="admin-input"
                placeholder="Allergies, conditions..."
              />
            </div>
          </div>
          {classes.length === 0 && !loadingClasses && (
            <p className="text-xs text-muted-foreground">
              Create a class before admitting a student.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="admin-btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loadingClasses || classes.length === 0}
              className="admin-btn-primary flex-1 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Admit Student"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BulkAdmissionModal({
  classes,
  loadingClasses,
  onClose,
  onImport,
}: {
  classes: ClassOption[];
  loadingClasses: boolean;
  onClose: () => void;
  onImport: (rows: BulkAdmissionRow[]) => Promise<BulkAdmissionOutcome[]>;
}) {
  const [rows, setRows] = useState<BulkAdmissionRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<BulkAdmissionOutcome[] | null>(null);
  const [classId, setClassId] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  async function selectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    setRows([]);
    setParseErrors([]);
    setOutcomes(null);
    setError("");
    setFileName(file?.name ?? "");
    if (!file) return;
    if (file.size > 2_000_000) {
      setError("Choose a CSV file smaller than 2 MB.");
      return;
    }
    try {
      const parsed = parseBulkAdmissionRows(await file.text());
      setRows(parsed.rows);
      setParseErrors(parsed.errors);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read this CSV file.");
    }
  }

  function downloadTemplate() {
    const blob = new Blob([`${csvHeaders.join(",")}\r\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "student-admission-template.csv";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function submitImport() {
    setImporting(true);
    setError("");
    try {
      const importedRows = rows.map((row) => ({
        ...row,
        input: { ...row.input, class_id: classId || null },
      }));
      setOutcomes(await onImport(importedRows));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not import students.");
    } finally {
      setImporting(false);
    }
  }

  const successfulCount = outcomes?.filter((outcome) => !outcome.error).length ?? 0;
  const failedOutcomes = outcomes?.filter((outcome) => outcome.error) ?? [];

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={importing ? undefined : onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">
              Import Students from CSV
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload names only; student IDs are generated automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            aria-label="Close CSV import"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Use a two-column CSV with first_name and last_name.
            </p>
            <button
              type="button"
              onClick={downloadTemplate}
              className="admin-btn-secondary flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Download template
            </button>
          </div>

          <div>
            <label className="admin-label" htmlFor="student-csv">
              CSV file
            </label>
            <input
              id="student-csv"
              type="file"
              accept=".csv,text/csv"
              onChange={selectFile}
              disabled={importing}
              className="admin-input file:mr-3 file:rounded file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-sm"
            />
            {fileName && <p className="mt-1 text-xs text-muted-foreground">{fileName}</p>}
          </div>

          <div>
            <label className="admin-label" htmlFor="bulk-student-class">
              Assign the imported students to a class (optional)
            </label>
            <select
              id="bulk-student-class"
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              disabled={loadingClasses || importing}
              className="admin-input"
            >
              <option value="">
                {loadingClasses ? "Loading classes…" : "Do not assign a class"}
              </option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.academic_year_name ? ` · ${item.academic_year_name}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              This choice applies to every student in the file.
            </p>
          </div>

          {rows.length > 0 && (
            <div className="rounded-lg border border-border p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">
                {rows.length} valid row{rows.length === 1 ? "" : "s"} ready to import
              </p>
              <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground">
                {rows.slice(0, 8).map((row) => (
                  <p key={row.rowNumber}>
                    Row {row.rowNumber}: {row.input.full_name}
                  </p>
                ))}
                {rows.length > 8 && <p>And {rows.length - 8} more…</p>}
              </div>
            </div>
          )}

          {parseErrors.length > 0 && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-4"
            >
              <p className="text-sm font-medium text-destructive">
                {parseErrors.length} row{parseErrors.length === 1 ? "" : "s"} skipped before import
              </p>
              <div className="mt-2 max-h-32 overflow-y-auto text-xs text-destructive">
                {parseErrors.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            </div>
          )}

          {outcomes && (
            <div role="status" className="rounded-lg border border-border p-4">
              <p className="text-sm font-medium text-foreground">
                Imported {successfulCount} student{successfulCount === 1 ? "" : "s"};{" "}
                {failedOutcomes.length + parseErrors.length} row
                {failedOutcomes.length + parseErrors.length === 1 ? "" : "s"} skipped.
              </p>
              {failedOutcomes.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto text-xs text-destructive">
                  {failedOutcomes.map((outcome) => (
                    <p key={outcome.rowNumber}>
                      Row {outcome.rowNumber}: {outcome.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="admin-btn-secondary flex-1"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => void submitImport()}
              disabled={importing || rows.length === 0 || outcomes !== null}
              className="admin-btn-primary flex-1 disabled:opacity-50"
            >
              {importing
                ? "Importing…"
                : outcomes
                  ? "Import complete"
                  : `Import ${rows.length} student${rows.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentProfile({
  student,
  initialTab,
  canManageStudents,
  onStatusChange,
  onClose,
}: {
  student: Student;
  initialTab: "Overview" | "Fees";
  canManageStudents: boolean;
  onStatusChange: (studentId: string, status: StudentStatus) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [details, setDetails] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusNotice, setStatusNotice] = useState("");
  const [exportingRecord, setExportingRecord] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    let cancelled = false;
    schoolApi<{ student: StudentRecord }>(`/api/school/students/${encodeURIComponent(student.id)}`)
      .then(({ student: record }) => {
        if (!cancelled) {
          setDetails(mapStudent(record));
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "Could not load this student profile");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [student.id]);

  const profile = details ?? student;
  const profileTabs = ["Overview", "Attendance", "Grades", "Fees"];

  async function toggleStudentStatus() {
    const active = profile.status !== "Active";
    if (
      !active &&
      !window.confirm(
        `Deactivate ${profile.name}? Their student record and history will be retained.`,
      )
    )
      return;
    setSavingStatus(true);
    setError("");
    setStatusNotice("");
    try {
      const result = await schoolApi<{ student: StudentRecord }>(
        `/api/school/students/${encodeURIComponent(student.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ active }),
        },
      );
      const updated = mapStudent(result.student);
      setDetails((current) => ({ ...(current ?? student), status: updated.status }));
      onStatusChange(student.id, updated.status);
      setStatusNotice(
        active
          ? "Student reactivated."
          : "Student deactivated. Their record and history are retained.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update student status");
    } finally {
      setSavingStatus(false);
    }
  }

  async function downloadStudentRecord() {
    setExportingRecord(true);
    setExportError("");
    try {
      const [attendance, grades, finances] = await Promise.all([
        fetchAllProfileRecords<AttendanceHistoryRecord>(
          `/api/school/students/${encodeURIComponent(student.id)}/history/attendance`,
        ),
        fetchAllProfileRecords<GradeHistoryRecord>(
          `/api/school/students/${encodeURIComponent(student.id)}/history/grades`,
        ),
        fetchAllProfileRecords<ProfileFinancialRecord>(
          "/api/school/student-financial-records",
          { student_id: student.id },
        ),
      ]);
      const exportData = {
        exported_at: new Date().toISOString(),
        student: profile,
        attendance,
        grades,
        financial_records: finances.records,
        financial_totals: finances.totals,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const safeAdmissionNumber = profile.studentId.replace(/[^a-z0-9_-]/gi, "-") || student.id;
      anchor.href = url;
      anchor.download = `student-record-${safeAdmissionNumber}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : "Could not download this student record");
    } finally {
      setExportingRecord(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-6 border-b border-border flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
              {profile.name
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">{profile.name}</h2>
              <p className="text-sm text-muted-foreground">
                {profile.studentId} · {profile.className}
              </p>
              <div className="mt-1.5">
                <StatusBadge status={profile.status} />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canManageStudents && (
              <button
                type="button"
                onClick={() => void downloadStudentRecord()}
                disabled={exportingRecord || loading || !details}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                <Download className="size-4" />
                {exportingRecord ? "Preparing…" : "Download record"}
              </button>
            )}
            <button onClick={onClose} aria-label="Close student profile">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>
        <div className="flex gap-1 px-6 border-b border-border">
          {profileTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="p-6">
          {error && (
            <p role="alert" className="mb-4 text-sm text-destructive">
              {error}
            </p>
          )}
          {statusNotice && (
            <p
              role="status"
              className="mb-4 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-3 py-2 text-sm text-emerald-800"
            >
              {statusNotice}
            </p>
          )}
          {exportError && (
            <p role="alert" className="mb-4 text-sm text-destructive">
              Could not download student record: {exportError}
            </p>
          )}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading saved profile details…</p>
          ) : activeTab === "Overview" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoCard
                icon={CalendarDays}
                label="Date of Birth"
                value={profile.dob || "Not recorded"}
              />
              <InfoCard
                icon={GraduationCap}
                label="Gender"
                value={profile.gender || "Not recorded"}
              />
              <InfoCard
                icon={Users}
                label="Guardian"
                value={profile.guardian || "Not recorded"}
                {...(profile.guardianRelationship ? { sub: profile.guardianRelationship } : {})}
              />
              <InfoCard
                icon={Phone}
                label="Guardian Phone"
                value={profile.phone || "Not recorded"}
              />
              <InfoCard icon={MapPin} label="Address" value={profile.address || "Not recorded"} />
              <InfoCard
                icon={Phone}
                label="Emergency Contact"
                value={profile.emergencyContact || "Not recorded"}
              />
              <InfoCard
                icon={Heart}
                label="Medical Notes"
                value={profile.medicalNote || "None recorded"}
              />
            </div>
          ) : activeTab === "Attendance" ? (
            <ProfileHistory key={`${student.id}-attendance`} studentId={student.id} type="attendance" />
          ) : activeTab === "Grades" ? (
            <ProfileHistory key={`${student.id}-grades`} studentId={student.id} type="grades" />
          ) : (
            <ProfileFees key={`${student.id}-fees`} studentId={student.id} />
          )}
          {canManageStudents && (
            <div className="mt-6 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => void toggleStudentStatus()}
                disabled={savingStatus || loading}
                className={
                  profile.status === "Active"
                    ? "admin-btn-secondary text-destructive"
                    : "admin-btn-primary"
                }
              >
                {savingStatus
                  ? "Saving…"
                  : profile.status === "Active"
                    ? "Deactivate student"
                    : "Reactivate student"}
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                {profile.status === "Active"
                  ? "Deactivation keeps this student’s record and history but removes them from active school workflows."
                  : "Reactivation restores this student to active school workflows."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type ProfilePage<T> = {
  records: T[];
  page: number;
  page_count: number;
  page_size: number;
  total_count: number;
};

type AttendanceHistoryRecord = {
  id: string;
  attendance_date: string;
  status: string;
  note: string | null;
  class_name: string;
};

type GradeHistoryRecord = {
  id: string;
  subject_name: string;
  class_name: string;
  term_name: string;
  academic_year_name: string;
  class_test_score: number | string | null;
  project_score: number | string | null;
  homework_score: number | string | null;
  group_work_score: number | string | null;
  exam_score: number | string | null;
  total_score: number | string | null;
  performance_level: string | null;
};

type ProfileFinancialRecord = {
  id: string;
  receipt_number: string | null;
  amount: number | string;
  currency: string;
  category: string;
  method: string;
  status: string;
  paid_at: string;
  daily_fee_date: string | null;
  fee_description: string;
  class_name: string | null;
  term_name: string | null;
  academic_year_name: string | null;
};

type ProfileFinancialReport = ProfilePage<ProfileFinancialRecord> & {
  totals: {
    currency: string;
    payment_count: number;
    verified_count: number;
    pending_count: number;
    verified_amount: number | string;
    pending_amount: number | string;
  }[];
};

async function fetchAllProfileRecords<T>(
  path: string,
  extraParams?: Record<string, string>,
): Promise<{ records: T[]; totals: ProfileFinancialReport["totals"] }> {
  const records: T[] = [];
  let totals: ProfileFinancialReport["totals"] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const params = new URLSearchParams({ ...extraParams, page: String(page), page_size: "100" });
    const result = await schoolApi<ProfilePage<T> & { totals?: ProfileFinancialReport["totals"] }>(
      `${path}?${params}`,
    );
    if (!Array.isArray(result.records) || !Number.isInteger(result.page_count) || result.page_count < 0) {
      throw new Error("The student record export returned an invalid page");
    }
    records.push(...result.records);
    if (page === 1 && result.totals) totals = result.totals;
    pageCount = result.page_count;
    page += 1;
  } while (page <= pageCount);
  return { records, totals };
}

function ProfileHistory({ studentId, type }: { studentId: string; type: "attendance" | "grades" }) {
  const [report, setReport] = useState<ProfilePage<AttendanceHistoryRecord | GradeHistoryRecord> | null>(null);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    void schoolApi<ProfilePage<AttendanceHistoryRecord | GradeHistoryRecord> & { summary?: Record<string, number> }>(
      `/api/school/students/${encodeURIComponent(studentId)}/history/${type}?${params}`,
    )
      .then((result) => {
        if (!cancelled) {
          setReport(result);
          setSummary(result.summary ?? {});
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setReport(null);
          setError(cause instanceof Error ? cause.message : `Could not load student ${type}`);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [page, studentId, type]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading saved {type} records…</p>;
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!report) return null;

  return (
    <div>
      {type === "attendance" && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          {["present", "late", "absent", "excused"].map((status) => (
            <span key={status} className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
              {status}: {summary[status] ?? 0}
            </span>
          ))}
        </div>
      )}
      {report.records.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No saved {type} records for this student yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[520px] text-left text-xs">
            {type === "attendance" ? (
              <>
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Class</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Note</th></tr>
                </thead>
                <tbody>
                  {(report.records as AttendanceHistoryRecord[]).map((record) => (
                    <tr key={record.id} className="border-t border-border/60">
                      <td className="px-3 py-2">{record.attendance_date.slice(0, 10)}</td>
                      <td className="px-3 py-2">{record.class_name}</td>
                      <td className="px-3 py-2 capitalize">{record.status}</td>
                      <td className="px-3 py-2 text-muted-foreground">{record.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            ) : (
              <>
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr><th className="px-3 py-2">Subject / period</th><th className="px-3 py-2">Class test</th><th className="px-3 py-2">Project</th><th className="px-3 py-2">Homework</th><th className="px-3 py-2">Group</th><th className="px-3 py-2">Exam</th><th className="px-3 py-2">Total</th><th className="px-3 py-2">Level</th></tr>
                </thead>
                <tbody>
                  {(report.records as GradeHistoryRecord[]).map((record) => (
                    <tr key={record.id} className="border-t border-border/60">
                      <td className="px-3 py-2"><span className="font-medium">{record.subject_name}</span><span className="block text-muted-foreground">{record.class_name} · {record.term_name} · {record.academic_year_name}</span></td>
                      <td className="px-3 py-2">{record.class_test_score ?? "—"}</td>
                      <td className="px-3 py-2">{record.project_score ?? "—"}</td>
                      <td className="px-3 py-2">{record.homework_score ?? "—"}</td>
                      <td className="px-3 py-2">{record.group_work_score ?? "—"}</td>
                      <td className="px-3 py-2">{record.exam_score ?? "—"}</td>
                      <td className="px-3 py-2">{record.total_score ?? "—"}</td>
                      <td className="px-3 py-2">{record.performance_level ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
        </div>
      )}
      <ProfilePager report={report} onPageChange={setPage} />
    </div>
  );
}

function ProfileFees({ studentId }: { studentId: string }) {
  const [report, setReport] = useState<ProfileFinancialReport | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ student_id: studentId, page: String(page), page_size: "20" });
    void schoolApi<ProfileFinancialReport>(`/api/school/student-financial-records?${params}`)
      .then((result) => { if (!cancelled) setReport(result); })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setReport(null);
          setError(cause instanceof Error ? cause.message : "Could not load student financial records");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, studentId]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading saved payment history…</p>;
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!report) return null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        {report.totals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payment records yet.</p>
        ) : report.totals.map((total) => (
          <div key={total.currency} className="rounded-lg border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">{total.currency} · {total.payment_count} records</p>
            <p className="text-sm font-semibold">{formatProfileAmount(total.verified_amount, total.currency)} verified</p>
            {Number(total.pending_amount) > 0 && <p className="text-xs text-muted-foreground">{formatProfileAmount(total.pending_amount, total.currency)} pending</p>}
          </div>
        ))}
      </div>
      {report.records.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No saved fee payments for this student yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Fee</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Method</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Receipt</th></tr>
            </thead>
            <tbody>
              {report.records.map((record) => (
                <tr key={record.id} className="border-t border-border/60">
                  <td className="px-3 py-2">{(record.daily_fee_date || record.paid_at).slice(0, 10)}</td>
                  <td className="px-3 py-2"><span className="font-medium">{record.fee_description}</span><span className="block text-muted-foreground">{[record.class_name, record.term_name, record.academic_year_name].filter(Boolean).join(" · ") || record.category.replaceAll("_", " ")}</span></td>
                  <td className="px-3 py-2">{formatProfileAmount(record.amount, record.currency)}</td>
                  <td className="px-3 py-2 capitalize">{record.method.replaceAll("_", " ")}</td>
                  <td className="px-3 py-2 capitalize">{record.status}</td>
                  <td className="px-3 py-2 font-mono">{record.receipt_number || "Not issued"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ProfilePager report={report} onPageChange={setPage} />
    </div>
  );
}

function ProfilePager({
  report,
  onPageChange,
}: {
  report: Pick<ProfilePage<unknown>, "page" | "page_count" | "page_size" | "total_count">;
  onPageChange: (page: number) => void;
}) {
  if (report.total_count === 0) return null;
  const first = (report.page - 1) * report.page_size + 1;
  const last = Math.min(report.page * report.page_size, report.total_count);
  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>Showing {first}–{last} of {report.total_count}</span>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Previous page" disabled={report.page <= 1} onClick={() => onPageChange(report.page - 1)} className="rounded border border-border p-1 disabled:opacity-40"><ChevronLeft className="size-4" /></button>
        <span>Page {report.page} of {report.page_count}</span>
        <button type="button" aria-label="Next page" disabled={report.page >= report.page_count} onClick={() => onPageChange(report.page + 1)} className="rounded border border-border p-1 disabled:opacity-40"><ChevronRight className="size-4" /></button>
      </div>
    </div>
  );
}

function formatProfileAmount(amount: number | string, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(amount));
}

function InfoCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5" />
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/students")({ component: StudentsPage });
