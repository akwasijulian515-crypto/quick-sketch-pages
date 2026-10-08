import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getNeonAccessToken } from "@/auth/client";
import { SchoolShell } from "@/components/school-shell";
import {
  Users, UserPlus, Search, Filter, MoreHorizontal, X,
  GraduationCap, CalendarDays, Phone, MapPin, Heart, FileText, ChevronDown,
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
  class_id: string;
  date_of_birth: string;
  gender: string;
  address: string;
  emergency_contact: string;
  medical_notes: string;
  guardian: { full_name: string; phone: string };
};

async function schoolApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getNeonAccessToken();
  const url = new URL(path, window.location.origin);
  const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
  if (tenant && !url.searchParams.has("tenant")) url.searchParams.set("tenant", tenant);
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${url.pathname}${url.search}`, { ...init, headers });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload
      && typeof payload.error === "string"
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
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
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
        if (!cancelled) setClassError(error instanceof Error ? error.message : "Could not load classes");
      })
      .finally(() => {
        if (!cancelled) setLoadingClasses(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), page_size: "50" });
      if (query.trim()) params.set("search", query.trim());
      if (filterClassId) params.set("class_id", filterClassId);
      schoolApi<{ students: StudentRecord[]; total: number }>(`/api/school/students?${params.toString()}`)
        .then((result) => {
          if (cancelled) return;
          const mapped = result.students.map(mapStudent);
          setStudents((current) => page === 1 ? mapped : [...current, ...mapped]);
          setTotal(result.total);
          setListError("");
        })
        .catch((error: unknown) => {
          if (!cancelled) setListError(error instanceof Error ? error.message : "Could not load students");
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

  return (
    <SchoolShell title="Students" schoolAdmin>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Students</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage student records and admissions</p>
          </div>
          <button onClick={() => setShowAdmission(true)} className="admin-btn-primary flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Admit Student
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={Users} label="Student records" value={loading && total === 0 ? "—" : String(total)} note="Matching this search" />
          <StatCard icon={GraduationCap} label="Classes" value={loadingClasses ? "—" : String(classes.length)} note="Available in this school" />
          <StatCard icon={CalendarDays} label="New this term" value="—" note="Not tracked yet" />
        </div>

        {notice && (
          <div role="status" className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
            <div className="flex items-center justify-between gap-3">
              <span>{notice}</span>
              <button onClick={() => setNotice("")} aria-label="Dismiss confirmation"><X className="w-4 h-4" /></button>
            </div>
          </div>
        )}
        {classError && <p role="alert" className="text-sm text-destructive">{classError}</p>}

        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
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
              onChange={(event) => { setPage(1); setQuery(event.target.value); }}
              placeholder="Search by name or student ID..."
              className="admin-input pl-10"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select value={filterClassId} onChange={(event) => { setPage(1); setFilterClassId(event.target.value); }} className="admin-input pl-10 pr-8 appearance-none min-w-[160px]">
              <option value="">All Classes</option>
              {classes.map((classItem) => <option key={classItem.id} value={classItem.id}>{classItem.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {activeTab === "All Students" || activeTab === "By Class" ? (
          <div className="admin-card overflow-hidden">
            {listError ? (
              <div role="alert" className="p-8 text-center">
                <p className="text-sm text-destructive">{listError}</p>
                <button className="admin-btn-secondary mt-3" onClick={() => { setPage(1); setReloadCount((count) => count + 1); }}>
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Student</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Student ID</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Class</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Attendance</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedStudent(student)}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                {student.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                              </div>
                              <span className="font-medium text-foreground">{student.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{student.studentId}</td>
                          <td className="px-5 py-3.5 text-foreground">{student.className}</td>
                          <td className="px-5 py-3.5 text-muted-foreground">Not connected</td>
                          <td className="px-5 py-3.5"><StatusBadge status={student.status} /></td>
                          <td className="px-3 py-3.5"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></td>
                        </tr>
                      ))}
                      {!loading && students.length === 0 && (
                        <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                          {query.trim() || filterClassId
                            ? "No students match these filters."
                            : "No student records yet. Admit a student to get started."}
                        </td></tr>
                      )}
                      {loading && students.length === 0 && (
                        <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">Loading student records…</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {students.length < total && !loading && (
                  <div className="p-4 border-t border-border text-center">
                    <button className="admin-btn-secondary" onClick={() => setPage((current) => current + 1)}>Load more students</button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : activeTab === "Admissions" ? (
          <div className="admin-card p-8 text-center">
            <UserPlus className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-semibold text-foreground">Admissions</h2>
            <p className="text-sm text-muted-foreground mt-1">New admissions are saved to this school’s student records.</p>
            <button onClick={() => setShowAdmission(true)} className="admin-btn-primary mt-4">Admit Student</button>
          </div>
        ) : (
          <div className="admin-card p-8 text-center">
            <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-semibold text-foreground">Attendance records</h2>
            <p className="text-sm text-muted-foreground mt-1">Student attendance summaries are not connected to this view yet.</p>
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
        {selectedStudent && (
          <StudentProfile
            student={selectedStudent}
            canManageStudents={canManageStudents}
            onStatusChange={(studentId, status) => {
              setStudents((current) => current.map((item) => item.id === studentId ? { ...item, status } : item));
              setSelectedStudent((current) => current?.id === studentId ? { ...current, status } : current);
            }}
            onClose={() => setSelectedStudent(null)}
          />
        )}
      </div>
    </SchoolShell>
  );
}

function StatCard({ icon: Icon, label, value, note }: { icon: typeof Users; label: string; value: string; note: string }) {
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
  const colors = status === "Active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground";
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${colors}`}>{status}</span>;
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
    <div className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div><h2 className="font-display text-lg font-bold text-foreground">Admit New Student</h2><p className="text-xs text-muted-foreground mt-0.5">Student and guardian details are saved to this school</p></div>
          <button onClick={onClose} aria-label="Close admission form"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <form className="p-6 space-y-4" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="admin-label">Full Name</label><input name="name" required className="admin-input" placeholder="e.g. Ama Mensah" /></div>
            <div>
              <label className="admin-label">Class</label>
              <select name="classId" required disabled={loadingClasses || classes.length === 0} className="admin-input">
                <option value="">{loadingClasses ? "Loading classes…" : classes.length ? "Select a class" : "No classes available"}</option>
                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.academic_year_name ? ` · ${item.academic_year_name}` : ""}</option>)}
              </select>
            </div>
            <div><label className="admin-label">Date of Birth</label><input name="dob" type="date" className="admin-input" /></div>
            <div><label className="admin-label">Gender</label><select name="gender" className="admin-input"><option value="">Select</option><option>Male</option><option>Female</option></select></div>
            <div><label className="admin-label">Guardian Name</label><input name="guardian" className="admin-input" placeholder="Parent/guardian" /></div>
            <div><label className="admin-label">Guardian Phone</label><input name="guardianPhone" className="admin-input" placeholder="024 000 0000" /></div>
            <div className="col-span-2"><label className="admin-label">Address</label><input name="address" className="admin-input" placeholder="Residential address" /></div>
            <div><label className="admin-label">Emergency Contact</label><input name="emergency" className="admin-input" placeholder="Phone number" /></div>
            <div><label className="admin-label">Medical Notes</label><input name="medical" className="admin-input" placeholder="Allergies, conditions..." /></div>
          </div>
          {classes.length === 0 && !loadingClasses && <p className="text-xs text-muted-foreground">Create a class before admitting a student.</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="admin-btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving || loadingClasses || classes.length === 0} className="admin-btn-primary flex-1 disabled:opacity-50">
              {saving ? "Saving…" : "Admit Student"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StudentProfile({
  student,
  canManageStudents,
  onStatusChange,
  onClose,
}: {
  student: Student;
  canManageStudents: boolean;
  onStatusChange: (studentId: string, status: StudentStatus) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState("Overview");
  const [details, setDetails] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusNotice, setStatusNotice] = useState("");

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
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load this student profile");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [student.id]);

  const profile = details ?? student;
  const profileTabs = ["Overview", "Attendance", "Grades", "Fees"];

  async function toggleStudentStatus() {
    const active = profile.status !== "Active";
    if (!active && !window.confirm(`Deactivate ${profile.name}? Their student record and history will be retained.`)) return;
    setSavingStatus(true);
    setError("");
    setStatusNotice("");
    try {
      const result = await schoolApi<{ student: StudentRecord }>(`/api/school/students/${encodeURIComponent(student.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      });
      const updated = mapStudent(result.student);
      setDetails((current) => ({ ...(current ?? student), status: updated.status }));
      onStatusChange(student.id, updated.status);
      setStatusNotice(active ? "Student reactivated." : "Student deactivated. Their record and history are retained.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update student status");
    } finally {
      setSavingStatus(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <div className="p-6 border-b border-border flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
              {profile.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">{profile.name}</h2>
              <p className="text-sm text-muted-foreground">{profile.studentId} · {profile.className}</p>
              <div className="mt-1.5"><StatusBadge status={profile.status} /></div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close student profile"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="flex gap-1 px-6 border-b border-border">
          {profileTabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-2.5 text-xs font-medium border-b-2 ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{tab}</button>
          ))}
        </div>
        <div className="p-6">
          {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
          {statusNotice && <p role="status" className="mb-4 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-3 py-2 text-sm text-emerald-800">{statusNotice}</p>}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading saved profile details…</p>
          ) : activeTab === "Overview" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoCard icon={CalendarDays} label="Date of Birth" value={profile.dob || "Not recorded"} />
              <InfoCard icon={GraduationCap} label="Gender" value={profile.gender || "Not recorded"} />
              <InfoCard icon={Users} label="Guardian" value={profile.guardian || "Not recorded"} {...(profile.guardianRelationship ? { sub: profile.guardianRelationship } : {})} />
              <InfoCard icon={Phone} label="Guardian Phone" value={profile.phone || "Not recorded"} />
              <InfoCard icon={MapPin} label="Address" value={profile.address || "Not recorded"} />
              <InfoCard icon={Phone} label="Emergency Contact" value={profile.emergencyContact || "Not recorded"} />
              <InfoCard icon={Heart} label="Medical Notes" value={profile.medicalNote || "None recorded"} />
            </div>
          ) : activeTab === "Attendance" ? (
            <ProfileMetric label="Attendance summary" value="—" note="Student attendance is not connected to this profile yet." />
          ) : activeTab === "Grades" ? (
            <ProfileMetric label="Grade records" value="—" note="Student grade details are not connected to this profile yet." />
          ) : (
            <ProfileMetric label="Fee balance" value="—" note="Student fee balances are not connected to this profile yet." />
          )}
          {canManageStudents && (
            <div className="mt-6 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => void toggleStudentStatus()}
                disabled={savingStatus || loading}
                className={profile.status === "Active" ? "admin-btn-secondary text-destructive" : "admin-btn-primary"}
              >
                {savingStatus ? "Saving…" : profile.status === "Active" ? "Deactivate student" : "Reactivate student"}
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

function InfoCard({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5" />
      <div><p className="text-[11px] text-muted-foreground">{label}</p><p className="text-sm font-medium text-foreground">{value}</p>{sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}</div>
    </div>
  );
}

function ProfileMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-xl border border-border p-5"><p className="text-sm font-medium text-foreground">{label}</p><p className="mt-2 text-2xl font-bold text-foreground">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p><FileText className="w-4 h-4 mt-4 text-muted-foreground" /></div>;
}

export const Route = createFileRoute("/students")({ component: StudentsPage });
