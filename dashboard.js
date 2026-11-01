
import { supabase } from "./config.js";
import { logout } from "./auth.js";

const studentName = document.getElementById("studentName");
const courseCount = document.getElementById("courseCount");
const quizCount = document.getElementById("quizCount");
const certificateCount = document.getElementById("certificateCount");

const myCourses = document.getElementById("myCourses");
const quizHistory = document.getElementById("quizHistory");
const myCertificates = document.getElementById("myCertificates");

document.getElementById("logoutBtn")?.addEventListener("click", logout);

function showError(container, message) {
  container.textContent = message;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

async function loadDashboard() {
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  const user = authData?.user;

  if (authError || !user) {
    window.location.href = "login.html";
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Profile error:", profileError.message);
  }

  studentName.textContent =
    profile?.full_name || user.email || "Student";

  await Promise.all([
    loadCourses(user.id),
    loadQuizHistory(user.id),
    loadCertificates(user.id)
  ]);
}

async function loadCourses(userId) {
  const { data, error } = await supabase
    .from("enrollments")
    .select(`
      id,
      progress,
      courses:course_id (
        id,
        title,
        description
      )
    `)
    .eq("student_id", userId);

  if (error) {
    showError(myCourses, error.message);
    return;
  }

  const courses = data || [];
  courseCount.textContent = courses.length;
  myCourses.replaceChildren();

  if (courses.length === 0) {
    myCourses.append(
      makeElement("p", "empty", "You have not enrolled in any courses yet.")
    );
    return;
  }

  courses.forEach(enrollment => {
    const course = enrollment.courses;
    if (!course) return;

    const progress = Math.max(
      0,
      Math.min(100, Number(enrollment.progress) || 0)
    );

    const card = makeElement("article", "course-card");
    card.append(
      makeElement("h3", "", course.title || "Untitled Course"),
      makeElement(
        "p",
        "muted",
        course.description || "Continue learning this course."
      ),
      makeElement("p", "muted", `${progress}% completed`)
    );

    const track = makeElement("div", "progress-track");
    const fill = makeElement("div", "progress-fill");
    fill.style.width = `${progress}%`;
    track.append(fill);
    card.append(track);

    myCourses.append(card);
  });
}

async function loadQuizHistory(userId) {
  const { data, error } = await supabase
    .from("quiz_results")
    .select("*")
    .eq("student_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    showError(quizHistory, error.message);
    return;
  }

  const results = data || [];
  quizCount.textContent = results.length;
  quizHistory.replaceChildren();

  if (results.length === 0) {
    quizHistory.append(
      makeElement("p", "empty", "No quiz attempts yet.")
    );
    return;
  }

  results.forEach(result => {
    const item = makeElement("article", "history-item");

    item.append(
      makeElement("strong", "", result.quiz_title || "Quiz"),
      makeElement(
        "p",
        "muted",
        `Score: ${result.score ?? "N/A"}`
      ),
      makeElement(
        "p",
        "muted",
        result.created_at
          ? new Date(result.created_at).toLocaleDateString()
          : "Date unavailable"
      )
    );

    quizHistory.append(item);
  });
}

async function loadCertificates(userId) {
  const { data, error } = await supabase
    .from("certificates")
    .select("*")
    .eq("student_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    showError(myCertificates, error.message);
    return;
  }

  const certificates = data || [];
  certificateCount.textContent = certificates.length;
  myCertificates.replaceChildren();

  if (certificates.length === 0) {
    myCertificates.append(
      makeElement("p", "empty", "No certificates issued yet.")
    );
    return;
  }

  certificates.forEach(certificate => {
    const item = makeElement("article", "certificate-item");

    item.append(
      makeElement(
        "strong",
        "",
        certificate.title || "Certificate"
      ),
      makeElement(
        "p",
        "muted",
        certificate.created_at
          ? `Issued: ${new Date(certificate.created_at).toLocaleDateString()}`
          : "Issue date unavailable"
      )
    );

    if (certificate.certificate_url) {
      const link = makeElement("a", "", "View Certificate");
      link.href = certificate.certificate_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      item.append(link);
    }

    myCertificates.append(item);
  });
}

loadDashboard().catch(error => {
  console.error("Dashboard error:", error);
});
