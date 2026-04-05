import { useState, useEffect } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { getEnrolledUsers, getUserGrades, getAssignments, getCourseCompletion } from "../services/moodle";
import {
  BarChart3, Loader2, Users, TrendingUp, CheckCircle, AlertTriangle,
  Clock, GraduationCap, FileCheck, Activity,
} from "lucide-react";

export default function CourseStatsPage() {
  const { courses, moodleToken, moodleUserId, useMock } = useApp();
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  useEffect(() => {
    if (!selectedCourseId) { setStats(null); return; }

    if (useMock || !moodleToken || moodleToken === "mock_token") {
      setStats({
        totalStudents: 28,
        activeStudents: 22,
        avgGrade: 6.8,
        approvedRate: 78,
        submissionRate: 85,
        gradeDistribution: [
          { range: "1-3", count: 2 },
          { range: "4-5", count: 5 },
          { range: "6-7", count: 10 },
          { range: "8-9", count: 8 },
          { range: "10", count: 3 },
        ],
        recentActivity: 18,
        assignmentCount: 5,
        completedAssignments: 3,
      });
      return;
    }

    let cancelled = false;
    setLoading(true);

    const loadStats = async () => {
      try {
        // Get enrolled students
        const enrolled = await getEnrolledUsers(moodleToken, selectedCourseId);
        const students = (enrolled || []).filter(u => u.roles?.some(r => r.roleid === 5 || r.shortname === "student"));

        // Count recently active (last 7 days)
        const weekAgo = Date.now() / 1000 - 86400 * 7;
        const activeStudents = students.filter(s => s.lastaccess && s.lastaccess > weekAgo).length;

        // Get grades for each student
        let totalGrade = 0;
        let gradedCount = 0;
        let approvedCount = 0;
        const dist = [
          { range: "1-3", count: 0 },
          { range: "4-5", count: 0 },
          { range: "6-7", count: 0 },
          { range: "8-9", count: 0 },
          { range: "10", count: 0 },
        ];

        for (const s of students.slice(0, 50)) { // limit to 50 for performance
          try {
            const g = await getUserGrades(moodleToken, selectedCourseId, s.id);
            if (cancelled) return;
            const courseGrade = g?.usergrades?.[0]?.gradeitems?.find(gi => gi.itemtype === "course");
            if (courseGrade?.graderaw != null) {
              const grade = courseGrade.graderaw;
              totalGrade += grade;
              gradedCount++;
              if (grade >= 4) approvedCount++;
              if (grade <= 3) dist[0].count++;
              else if (grade <= 5) dist[1].count++;
              else if (grade <= 7) dist[2].count++;
              else if (grade <= 9) dist[3].count++;
              else dist[4].count++;
            }
          } catch {}
        }

        // Get assignments
        const assignData = await getAssignments(moodleToken, [selectedCourseId]);
        const assignCount = assignData?.courses?.[0]?.assignments?.length || 0;

        if (!cancelled) {
          setStats({
            totalStudents: students.length,
            activeStudents,
            avgGrade: gradedCount > 0 ? (totalGrade / gradedCount).toFixed(1) : "-",
            approvedRate: gradedCount > 0 ? Math.round((approvedCount / gradedCount) * 100) : 0,
            gradeDistribution: dist,
            recentActivity: activeStudents,
            assignmentCount: assignCount,
            submissionRate: 0, // would need per-assignment data
          });
        }
      } catch (err) {
        console.error("Error loading stats:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadStats();
    return () => { cancelled = true; };
  }, [selectedCourseId, moodleToken, useMock]);

  const gradeColor = (grade) => {
    const num = parseFloat(grade);
    if (isNaN(num)) return P.textMuted;
    if (num >= 7) return "#059669";
    if (num >= 4) return "#D97706";
    return "#DC2626";
  };

  const maxDistCount = stats ? Math.max(...stats.gradeDistribution.map(d => d.count), 1) : 1;
  const barColors = ["#DC2626", "#D97706", "#2E86C1", "#059669", "#7c3aed"];

  return (
    <div>
      <h1 style={{ fontFamily: ff.heading, fontSize: 26, fontWeight: 700, color: P.text, marginBottom: 6 }}>
        Estadísticas
      </h1>
      <p style={{ color: P.textMuted, fontSize: 14, marginBottom: 24 }}>
        Panorama general del rendimiento de cada materia
      </p>

      {/* Course selector */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        {courses.map(c => (
          <button key={c.id} onClick={() => setSelectedCourseId(c.id)}
            style={{
              padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500,
              background: selectedCourseId === c.id ? c.color : P.card,
              color: selectedCourseId === c.id ? "#fff" : P.textSec,
              border: `1px solid ${selectedCourseId === c.id ? c.color : P.border}`,
              cursor: "pointer", transition: "all 0.2s",
            }}>
            {c.shortname || c.fullname.substring(0, 15)}
          </button>
        ))}
      </div>

      {!selectedCourseId ? (
        <div style={{ background: P.card, borderRadius: 16, padding: "60px 32px", textAlign: "center", border: `1px solid ${P.border}` }}>
          <BarChart3 size={48} style={{ color: P.textMuted, marginBottom: 16 }} />
          <p style={{ color: P.textMuted, fontSize: 15 }}>Seleccioná una materia para ver las estadísticas</p>
        </div>
      ) : loading ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <Loader2 size={28} style={{ color: P.primary, animation: "spin 1s linear infinite" }} />
          <p style={{ color: P.textMuted, fontSize: 13, marginTop: 12 }}>Calculando estadísticas...</p>
        </div>
      ) : stats ? (
        <>
          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
            {[
              { label: "Alumnos inscriptos", value: stats.totalStudents, Icon: Users, color: "#2E86C1" },
              { label: "Activos (7 días)", value: stats.activeStudents, Icon: Activity, color: "#059669" },
              { label: "Promedio general", value: stats.avgGrade, Icon: TrendingUp, color: gradeColor(stats.avgGrade) },
              { label: "Tasa de aprobación", value: `${stats.approvedRate}%`, Icon: CheckCircle, color: stats.approvedRate >= 60 ? "#059669" : "#D97706" },
              { label: "Trabajos prácticos", value: stats.assignmentCount, Icon: FileCheck, color: "#7c3aed" },
            ].map((kpi, i) => (
              <div key={i} style={{ background: P.card, borderRadius: 14, padding: "20px 20px", border: `1px solid ${P.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: kpi.color + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <kpi.Icon size={16} style={{ color: kpi.color }} />
                  </div>
                  <span style={{ fontSize: 11, color: P.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{kpi.label}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Grade Distribution */}
          <div style={{ background: P.card, borderRadius: 16, padding: 24, border: `1px solid ${P.border}`, marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: P.text, marginBottom: 20 }}>Distribución de notas</h3>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 160 }}>
              {stats.gradeDistribution.map((d, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: barColors[i] }}>{d.count}</span>
                  <div style={{
                    width: "100%", maxWidth: 60,
                    height: `${Math.max((d.count / maxDistCount) * 120, 4)}px`,
                    background: barColors[i],
                    borderRadius: "6px 6px 0 0",
                    transition: "height 0.5s ease",
                    opacity: 0.85,
                  }} />
                  <span style={{ fontSize: 11, color: P.textMuted, fontWeight: 500 }}>{d.range}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity summary */}
          <div style={{ background: P.card, borderRadius: 16, padding: 24, border: `1px solid ${P.border}` }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: P.text, marginBottom: 16 }}>Resumen de actividad</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: P.textSec }}>Alumnos activos en los últimos 7 días</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: P.text }}>
                  {stats.activeStudents} / {stats.totalStudents}
                  <span style={{ fontSize: 12, color: P.textMuted, marginLeft: 6 }}>
                    ({stats.totalStudents > 0 ? Math.round((stats.activeStudents / stats.totalStudents) * 100) : 0}%)
                  </span>
                </span>
              </div>
              {/* Activity bar */}
              <div style={{ height: 8, borderRadius: 4, background: P.borderLight, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 4,
                  width: `${stats.totalStudents > 0 ? (stats.activeStudents / stats.totalStudents) * 100 : 0}%`,
                  background: "linear-gradient(90deg, #2E86C1, #059669)",
                  transition: "width 0.5s ease",
                }} />
              </div>
              {stats.totalStudents - stats.activeStudents > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "#D9770615", fontSize: 12, color: "#D97706" }}>
                  <AlertTriangle size={14} />
                  {stats.totalStudents - stats.activeStudents} alumno{stats.totalStudents - stats.activeStudents !== 1 ? "s" : ""} sin actividad reciente
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}