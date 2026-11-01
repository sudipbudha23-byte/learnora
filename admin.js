
import { supabase } from "./config.js";
import { logout } from "./auth.js";

const $ = id => document.getElementById(id);

let adminUser;

function message(id, text, success = false) {
  const element = $(id);
  element.textContent = text;
  element.className = success
    ? "message success"
    : "message error";
}

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

// VERIFY ADMIN
async function initializeAdmin() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    location.replace("login.html");
    return;
  }

  adminUser = data.user;

  const { data: admin, error: adminError } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", adminUser.id)
    .maybeSingle();

  if (adminError || !admin) {
    alert("Access denied. Admin account required.");
    location.replace("dashboard.html");
    return;
  }

  await loadStatistics();
  await loadCourses();
  await loadStudents();
}

// STATISTICS
async function loadStatistics() {
  const queries = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("courses").select("id", { count: "exact", head: true }),
    supabase.from("certificates").select("id", { count: "exact", head: true })
  ]);

  $("studentCount").textContent =
    queries[0].error ? "—" : queries[0].count;

  $("courseCount").textContent =
    queries[1].error ? "—" : queries[1].count;

  $("certificateCount").textContent =
    queries[2].error ? "—" : queries[2].count;
}

// ADD COURSE
$("courseForm").addEventListener("submit", async event => {
  event.preventDefault();

  const title = $("courseTitle").value.trim();
  const category = $("courseCategory").value.trim();
  const description = $("courseDescription").value.trim();

  const { error } = await supabase
    .from("courses")
    .insert({ title, category, description });

  if (error) {
    message("courseMessage", error.message);
    return;
  }

  $("courseForm").reset();
  message("courseMessage", "Course added successfully.", true);

  await loadCourses();
  await loadStatistics();
});

// LOAD COURSES
async function loadCourses() {
  const container = $("courseList");

  const { data, error } = await supabase
    .from("courses")
    .select("id, title, category, description")
    .order("id", { ascending: false });

  if (error) {
    container.textContent = error.message;
    return;
  }

  if (!data.length) {
    container.textContent = "No courses found.";
    return;
  }

  container.innerHTML = data.map(course => `
    <div class="list-item">
      <strong>${safe(course.title)}</strong>
      <p class="muted">
        ID: ${course.id} · ${safe(course.category)}
      </p>
      <p class="muted">${safe(course.description)}</p>
      <button class="btn btn-outline"
        data-delete-course="${course.id}">
        Delete Course
      </button>
    </div>
  `).join("");

  container.querySelectorAll("[data-delete-course]").forEach(button => {
    button.addEventListener("click", async () => {
      const id = Number(button.dataset.deleteCourse);

      if (!Number.isSafeInteger(id) ||
          !confirm("Delete this course and its enrollments?")) return;

      const { error } = await supabase
        .from("courses")
        .delete()
        .eq("id", id);

      if (error) {
        alert(error.message);
        return;
      }

      await loadCourses();
      await loadStatistics();
    });
  });
}

// LOAD STUDENTS
async function loadStudents() {
  const container = $("studentList");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    container.textContent = error.message;
    return;
  }

  if (!data.length) {
    container.textContent = "No students registered yet.";
    return;
  }

  container.innerHTML = data.map(student => `
    <div class="list-item">
      <strong>${safe(student.full_name)}</strong>
      <p class="muted">${safe(student.email)}</p>
      <p class="muted">Student ID: ${safe(student.id)}</p>
    </div>
  `).join("");
}

// UPDATE ENROLLMENT PROGRESS
$("progressForm").addEventListener("submit", async event => {
  event.preventDefault();

  const studentId = $("studentId").value.trim();
  const courseId = Number($("courseId").value);
  const progress = Number($("progress").value);

  if (!Number.isSafeInteger(courseId) ||
      !Number.isInteger(progress) ||
      progress < 0 || progress > 100) {
    message("progressMessage", "Enter a valid course ID and progress.");
    return;
  }

  const { error } = await supabase
    .from("enrollments")
    .update({ progress })
    .eq("student_id", studentId)
    .eq("course_id", courseId);

  if (error) {
    message("progressMessage", error.message);
    return;
  }

  message(
    "progressMessage",
    "Progress updated. The student must already be enrolled.",
    true
  );
});

// ISSUE CERTIFICATE
$("certificateForm").addEventListener("submit", async event => {
  event.preventDefault();

  const studentId = $("certificateStudent").value.trim();
  const title = $("certificateTitle").value.trim();

  const { error } = await supabase
    .from("certificates")
    .insert({
      student_id: studentId,
      title
    });

  if (error) {
    message("certificateMessage", error.message);
    return;
  }

  $("certificateForm").reset();

  message(
    "certificateMessage",
    "Certificate issued successfully.",
    true
  );

  await loadStatistics();
});

// LOGOUT
$("logoutButton").addEventListener("click", logout);

// START
initializeAdmin();
// =====================================
// STUDENT ENROLLMENT SYSTEM
// =====================================

const enrollmentForm = document.getElementById("enrollmentForm");
const studentSelect = document.getElementById("studentSelect");
const courseSelect = document.getElementById("courseSelect");
const enrollmentMessage = document.getElementById("enrollmentMessage");
const enrollmentList = document.getElementById("enrollmentList");

async function loadEnrollmentOptions() {
  if (!studentSelect || !courseSelect) return;

  const { data: students, error: studentError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name");

  const { data: courses, error: courseError } = await supabase
    .from("courses")
    .select("id, title")
    .order("title");

  if (studentError || courseError) {
    enrollmentMessage.textContent =
      studentError?.message || courseError?.message;
    return;
  }

  studentSelect.innerHTML =
    '<option value="">Choose a student</option>';

  (students || []).forEach(student => {
    const option = document.createElement("option");
    option.value = student.id;
    option.textContent =
      `${student.full_name || "Student"} (${student.email || "No email"})`;
    studentSelect.appendChild(option);
  });

  courseSelect.innerHTML =
    '<option value="">Choose a course</option>';

  (courses || []).forEach(course => {
    const option = document.createElement("option");
    option.value = course.id;
    option.textContent = course.title;
    courseSelect.appendChild(option);
  });
}

async function loadEnrollmentList() {
  if (!enrollmentList) return;

  enrollmentList.textContent = "Loading enrollments...";

  const { data, error } = await supabase
    .from("enrollments")
    .select(`
      id,
      progress,
      student_id,
      course_id,
      profiles:student_id(full_name, email),
      courses:course_id(title)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    enrollmentList.textContent = error.message;
    return;
  }

  if (!data || data.length === 0) {
    enrollmentList.textContent = "No enrollments yet.";
    return;
  }

  enrollmentList.innerHTML = "";

  data.forEach(item => {
    const row = document.createElement("div");
    row.className = "enrollment-card";

    const studentName =
      item.profiles?.full_name || item.profiles?.email || "Student";

    const courseName = item.courses?.title || "Course";

    row.innerHTML = `
      <strong></strong>
      <p></p>
      <label>Progress (%)</label>
      <input type="number" min="0" max="100"
        value="${Number(item.progress) || 0}"
        class="progress-input">
      <button type="button">Update Progress</button>
    `;

    row.querySelector("strong").textContent = studentName;
    row.querySelector("p").textContent = courseName;

    row.querySelector("button").addEventListener("click", async () => {
      const input = row.querySelector(".progress-input");
      const progress = Number(input.value);

      if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
        alert("Progress must be a whole number from 0 to 100.");
        return;
      }

      const { error: updateError } = await supabase
        .from("enrollments")
        .update({ progress })
        .eq("id", item.id);

      if (updateError) {
        alert(updateError.message);
        return;
      }

      alert("Progress updated successfully!");
      loadEnrollmentList();
    });

    enrollmentList.appendChild(row);
  });
}

if (enrollmentForm) {
  enrollmentForm.addEventListener("submit", async event => {
    event.preventDefault();

    const studentId = studentSelect.value;
    const courseId = courseSelect.value;

    if (!studentId || !courseId) {
      enrollmentMessage.textContent =
        "Please select a student and a course.";
      return;
    }

    enrollmentMessage.textContent = "Enrolling student...";

    const { error } = await supabase
      .from("enrollments")
      .upsert(
        {
          student_id: studentId,
          course_id: courseId,
          progress: 0
        },
        {
          onConflict: "student_id,course_id",
          ignoreDuplicates: true
        }
      );

    if (error) {
      enrollmentMessage.textContent = error.message;
      return;
    }

    enrollmentMessage.textContent =
      "Student enrollment completed!";

    enrollmentForm.reset();
    await loadEnrollmentList();
  });
}

// Load enrollment data when the admin page opens
loadEnrollmentOptions();
loadEnrollmentList();
