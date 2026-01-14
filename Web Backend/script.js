
const AUTH_KEY = "mowakebUser";
const FAV_KEY = "mowakebFavorites";
const SEARCH_KEY = "mowakebLastSearch";
const SELECTED_PAPER_KEY = "mowakebSelectedPaper";
const TTS_API_URL = "https://mowakeb.onrender.com/api/podcast-tts";
const CHATBOT_BASE_URL = "https://project1-production-76db.up.railway.app";


// Local user & favorites helpers

function getUser() {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.loggedIn) {
      return parsed;
    }
  } catch (e) {
    if (raw === "true") {
      return { loggedIn: true };
    }
  }
  return null;
}

function setUser(data) {
  localStorage.setItem(
    AUTH_KEY,
    JSON.stringify({ ...(data || {}), loggedIn: true })
  );
}

function clearUser() {
  localStorage.removeItem(AUTH_KEY);
}

function getFavorites() {
  const raw = localStorage.getItem(FAV_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setFavorites(favs) {
  localStorage.setItem(FAV_KEY, JSON.stringify(favs || []));
}

function isLoggedIn() {
  return !!getUser();
}


// Supabase-backed tracker helpers


async function dbAddTrackerEntry({
  ownerEmail,
  authUserId,
  paperTitle,
  topic,
  field,
  status,
  notes,
}) {
  try {
    const row = {
      owner_email: ownerEmail,
      paper_title: paperTitle,
      topic,
      field,
      status,
      notes,
    };

    if (authUserId) {
      row.auth_user_id = authUserId;
    }

    const { data, error } = await supabaseClient
      .from("reading_tracker")
      .insert([row]);

    if (error) {
      console.error("Error inserting tracker entry:", error);
    } else {
      console.log("Inserted tracker entry:", data);
    }
  } catch (err) {
    console.error("Unexpected error inserting tracker entry:", err);
  }
}

async function dbGetTrackerEntries(ownerEmail) {
  try {
    const { data, error } = await supabaseClient
      .from("reading_tracker")
      .select("*")
      .eq("owner_email", ownerEmail)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading tracker entries:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Unexpected error loading tracker entries:", err);
    return [];
  }
}

async function dbUpdateTrackerStatus(id, newStatus) {
  try {
    const { data, error } = await supabaseClient
      .from("reading_tracker")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("Error updating tracker status:", error);
    } else {
      console.log("Updated tracker status:", data);
    }
  } catch (err) {
    console.error("Unexpected error updating tracker status:", err);
  }
}

async function dbDeleteTrackerEntry(id) {
  try {
    const { error } = await supabaseClient
      .from("reading_tracker")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting tracker entry:", error);
    }
  } catch (err) {
    console.error("Unexpected error deleting tracker entry:", err);
  }
}


// Navbar & layout helpers


function updateNav() {
  const user = getUser();

  const profileLink = document.querySelector(".nav-profile");
  const trackingLink = document.querySelector(".nav-tracking");
  const loginBtn = document.querySelector(".nav-login");
  const signupBtn = document.querySelector(".nav-signup");

  if (profileLink) {
    if (user) profileLink.classList.remove("hidden");
    else profileLink.classList.add("hidden");
  }

  if (trackingLink) {
    if (user) trackingLink.classList.remove("hidden");
    else trackingLink.classList.add("hidden");
  }

  if (loginBtn) {
    if (user) loginBtn.classList.add("hidden");
    else loginBtn.classList.remove("hidden");
  }

  if (signupBtn) {
    if (user) signupBtn.classList.add("hidden");
    else signupBtn.classList.remove("hidden");
  }
}


// Tracker UI rendering


function renderFavorites() {
  const listEl = document.querySelector(".favorites-list");
  const emptyEl = document.querySelector(".favorites-empty-message");
  const toReadEl = document.querySelector(".tracker-to-read");
  const inProgEl = document.querySelector(".tracker-in-progress");
  const doneEl = document.querySelector(".tracker-done");

  if (!listEl) return;

  const favs = getFavorites();
  listEl.innerHTML = "";

  if (favs.length === 0) {
    if (emptyEl) emptyEl.style.display = "block";
  } else if (emptyEl) {
    emptyEl.style.display = "none";
  }

  let toRead = 0,
    inProg = 0,
    done = 0;

  favs.forEach((fav, index) => {
    if (fav.status === "done") done++;
    else if (fav.status === "in-progress") inProg++;
    else toRead++;

    const li = document.createElement("li");
    li.className = "favorite-card";

    const header = document.createElement("div");
    header.className = "favorite-header";

    const title = document.createElement("div");
    title.className = "favorite-title";
    title.textContent = fav.title || "Untitled paper";

    const badge = document.createElement("span");
    badge.className =
      "favorite-status-badge " +
      (fav.status === "done"
        ? "badge-done"
        : fav.status === "in-progress"
        ? "badge-in-progress"
        : "badge-to-read");
    badge.textContent =
      fav.status === "done"
        ? "Completed"
        : fav.status === "in-progress"
        ? "In progress"
        : "To read";

    header.appendChild(title);
    header.appendChild(badge);
    li.appendChild(header);

    if (fav.notes) {
      const notes = document.createElement("p");
      notes.className = "favorite-notes";
      notes.textContent = fav.notes;
      li.appendChild(notes);
    }

    const footer = document.createElement("div");
    footer.className = "favorite-footer";

    const statusWrapper = document.createElement("div");
    const label = document.createElement("label");
    label.textContent = "Update status:";
    const select = document.createElement("select");
    select.className = "input";
    ["to-read", "in-progress", "done"].forEach((value) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent =
        value === "done"
          ? "Completed"
          : value === "in-progress"
          ? "In progress"
          : "To read";
      if (value === fav.status) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener("change", async () => {
      const updated = getFavorites();
      if (updated[index]) {
        updated[index].status = select.value;
        setFavorites(updated);

        if (updated[index].id) {
          await dbUpdateTrackerStatus(updated[index].id, select.value);
        }

        renderFavorites();
      }
    });

    statusWrapper.appendChild(label);
    statusWrapper.appendChild(select);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "favorite-remove";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async () => {
      const current = getFavorites();
      const entry = current[index];

      if (entry && entry.id) {
        await dbDeleteTrackerEntry(entry.id);
      }

      const updated = getFavorites();
      updated.splice(index, 1);
      setFavorites(updated);
      renderFavorites();
    });

    footer.appendChild(statusWrapper);
    footer.appendChild(removeBtn);

    li.appendChild(footer);
    listEl.appendChild(li);
  });

  if (toReadEl) toReadEl.textContent = String(toRead);
  if (inProgEl) inProgEl.textContent = String(inProg);
  if (doneEl) doneEl.textContent = String(done);
}

async function loadTrackerFromDbAndRender() {
  const trackingUser = getUser();
  if (!trackingUser || !trackingUser.email) {
    renderFavorites();
    return;
  }

  const entries = await dbGetTrackerEntries(trackingUser.email);

  const mapped = entries.map((row) => ({
    id: row.id,
    title: row.paper_title,
    status: row.status || "to-read",
    notes: row.notes || (row.field ? `Field: ${row.field}` : ""),
  }));

  setFavorites(mapped);
  renderFavorites();
}


// Main DOMContentLoaded


document.addEventListener("DOMContentLoaded", () => {
  // Mobile nav toggle
  const navToggle = document.getElementById("nav-toggle");
  const navLinks = document.getElementById("nav-links");

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      navLinks.classList.toggle("nav-open");
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("nav-open");
      });
    });
  }

  // Dynamic year in footer
  const yearSpan = document.getElementById("year");
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // Update nav based on login state
  updateNav();

  //Auth (signup / login / logout) 
  const signupForm = document.querySelector(".signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("signup-name")?.value || "";
      const email = document.getElementById("signup-email")?.value || "";
      const pass = document.getElementById("signup-password")?.value || "";
      const field = document.getElementById("signup-field")?.value || "AI";

      if (!email || !pass) {
        alert("Please enter email and password.");
        return;
      }

      try {
        console.log("Signing up…", { email, field });

        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password: pass,
          options: {
            data: {
              full_name: name,
              field_preference: field,
            },
          },
        });

        if (error) {
          console.error("Sign up error:", error);
          alert(error.message || "Sign up failed.");
          return;
        }

        const user = data.user;
        console.log("Sign up user:", user);

        if (user) {
          setUser({
            id: user.id,
            name: name || user.user_metadata?.full_name || "Researcher",
            email: user.email,
            field: field,
          });

          try {
            const { data: insertData, error: insertError } = await supabaseClient
              .from("mowakeb_users")
              .insert([
                {
                  auth_user_id: user.id,
                  email: user.email,
                  full_name: name || user.user_metadata?.full_name || null,
                  field: field,
                },
              ])
              .select();

            if (insertError) {
              console.error(
                "Insert into mowakeb_users error:",
                insertError
              );
              alert(
                "User created but profile row failed: " +
                  insertError.message
              );
            } else {
              console.log("Inserted into mowakeb_users:", insertData);
            }
          } catch (insertErr) {
            console.error("Unexpected insert error:", insertErr);
          }

          window.location.href = "profile.html";
        }
      } catch (err) {
        console.error("Unexpected sign up error:", err);
        alert("Sign up failed. Please try again.");
      }
    });
  }

  const loginForm = document.querySelector(".login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("login-email")?.value || "";
      const pass = document.getElementById("login-password")?.value || "";

      if (!email || !pass) {
        alert("Please enter email and password.");
        return;
      }

      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email,
          password: pass,
        });

        if (error) {
          console.error("Login error:", error);
          alert(error.message || "Login failed.");
          return;
        }

        const user = data.user;

        if (user) {
          setUser({
            id: user.id,
            name: user.user_metadata?.full_name || "Researcher",
            email: user.email,
            field: user.user_metadata?.field_preference || "AI",
          });
        }

        window.location.href = "profile.html";
      } catch (err) {
        console.error("Unexpected login error:", err);
        alert("Login failed. Please try again.");
      }
    });
  }

  const logoutButtons = document.querySelectorAll(".logout-btn");
  logoutButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      clearUser();
      window.location.href = "index.html";
    });
  });

  // Profile page 
  const profileName = document.querySelector(".profile-name");
  const profileEmail = document.querySelector(".profile-email");
  const profileField = document.querySelector(".profile-field");
  const profileStatus = document.querySelector(".profile-status");
  const fieldSelect = document.getElementById("profile-field-select");
  const saveMessage = document.querySelector(".profile-save-message");
  const profileLayout = document.querySelector(".profile-layout");

  const user = getUser();

  if (profileLayout) {
    if (!user) {
      if (profileStatus) profileStatus.textContent = "Not logged in";
      if (profileName) profileName.textContent = "Guest";
      if (profileEmail) profileEmail.textContent = "—";
      if (profileField) profileField.textContent = "—";
    } else {
      if (profileName) profileName.textContent = user.name || "Researcher";
      if (profileEmail) profileEmail.textContent = user.email || "Not set";
      if (profileField) profileField.textContent = user.field || "AI";
      if (profileStatus) profileStatus.textContent = "Active";

      if (fieldSelect) {
        fieldSelect.value = user.field || "AI";
      }
    }
  }

  if (fieldSelect) {
    const form = document.querySelector(".profile-preferences-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const updatedField = fieldSelect.value || "AI";
        const current = getUser() || { name: "Researcher" };
        setUser({ ...current, field: updatedField });

        if (profileField) profileField.textContent = updatedField;
        if (saveMessage) {
          saveMessage.textContent = "Preferences saved.";
          setTimeout(() => {
            saveMessage.textContent = "";
          }, 2500);
        }
      });
    }
  }

  // Tracking page 
  const trackingLayout = document.querySelector(".tracking-layout");
  const favoritesForm = document.querySelector(".favorites-form");
  const trackingUser = getUser();

  if (trackingLayout && !trackingUser) {
    window.location.href = "login.html";
    return;
  }

  if (favoritesForm) {
    favoritesForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const titleInput = document.getElementById("fav-title");
      const statusInput = document.getElementById("fav-status");
      const notesInput = document.getElementById("fav-notes");

      const title = titleInput?.value.trim();
      const status = statusInput?.value || "to-read";
      const notes = notesInput?.value.trim() || "";

      if (!title) return;

      const favs = getFavorites();
      const newItem = { title, status, notes };
      favs.push(newItem);
      setFavorites(favs);

      if (trackingUser && trackingUser.email) {
        await dbAddTrackerEntry({
          ownerEmail: trackingUser.email,
          authUserId: trackingUser.id,
          paperTitle: title,
          topic: null,
          field: trackingUser.field || "AI",
          status,
          notes,
        });
      }

      if (titleInput) titleInput.value = "";
      if (notesInput) notesInput.value = "";
      if (statusInput) statusInput.value = "to-read";

      await loadTrackerFromDbAndRender();
    });
  }

  if (document.querySelector(".favorites-list")) {
    loadTrackerFromDbAndRender();
  }

  // Home search form
  const searchForm = document.getElementById("search-form");
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const fieldSelectEl = document.getElementById("field");
      const queryInput = document.getElementById("query");

      const field =
        fieldSelectEl?.options[fieldSelectEl.selectedIndex]?.text ||
        fieldSelectEl?.value ||
        "Artificial Intelligence (AI)";

      const topic = (queryInput?.value || "").trim() || "Top 5 papers";

      localStorage.setItem(
        SEARCH_KEY,
        JSON.stringify({
          field,
          topic,
          timestamp: new Date().toISOString(),
        })
      );

      window.location.href = "results.html";
    });
  }

  
 
  // Demo data for results/summary

  const DEMO_PAPERS_BY_FIELD = {
    "Artificial Intelligence (AI)": [
      {
        title: "Paper 1 – Large Language Models for Research Assistance",
        summary:
          "Shows how large language models can help researchers search, summarize, and draft scientific content faster.",
      },
      {
        title: "Paper 2 – Prompt Engineering for Reliable AI Outputs",
        summary:
          "Discusses practical prompt patterns that make AI answers more stable, accurate, and controllable.",
      },
      {
        title: "Paper 3 – Evaluating AI-generated Scientific Text",
        summary:
          "Proposes methods to check the quality and correctness of AI-written abstracts and paragraphs.",
      },
      {
        title: "Paper 4 – Human–AI Collaboration in Academic Writing",
        summary:
          "Explores workflows where humans and AI write together while keeping the researcher in control.",
      },
      {
        title: "Paper 5 – Ethical Risks of Generative Models",
        summary:
          "Explains the main risks of using generative AI in research and how to reduce them.",
      },
    ],

    "Data Science & Analytics": [
      {
        title: "Paper 1 – Building a Reproducible Analytics Pipeline",
        summary:
          "Describes how to design analytics projects so that results can be reproduced and audited later.",
      },
      {
        title: "Paper 2 – Visual Analytics for Decision Makers",
        summary:
          "Shows how to turn complex data into dashboards that managers can actually understand.",
      },
      {
        title: "Paper 3 – A/B Testing and Experiment Design in Practice",
        summary:
          "Covers the full lifecycle of online experiments, from hypothesis to interpretation.",
      },
      {
        title: "Paper 4 – Handling Imbalanced Datasets",
        summary:
          "Compares techniques for dealing with rare events such as fraud, churn, or failures.",
      },
      {
        title: "Paper 5 – Time Series Forecasting for Operations",
        summary:
          "Shares lessons from real forecasting projects for demand, traffic, and resource planning.",
      },
    ],

    "Systems & Infrastructure": [
      {
        title: "Paper 1 – Scalable Microservices for AI Workloads",
        summary:
          "Presents patterns for deploying AI models behind APIs that can scale to millions of requests.",
      },
      {
        title: "Paper 2 – Observability for Distributed Systems",
        summary:
          "Explains how logs, metrics, and traces work together to debug complex back-end systems.",
      },
      {
        title: "Paper 3 – Cost Optimization in Cloud Architectures",
        summary:
          "Shows strategies to reduce cloud bills while keeping good performance and reliability.",
      },
      {
        title: "Paper 4 – CI/CD for Machine Learning Systems",
        summary:
          "Describes continuous integration and deployment pipelines designed specifically for ML models.",
      },
      {
        title: "Paper 5 – Caching and Latency Reduction Techniques",
        summary:
          "Explores how caching, load-balancing, and CDNs can make AI-powered apps feel instant.",
      },
    ],

    "Security & Privacy": [
      {
        title: "Paper 1 – Threat Modeling for Web Applications",
        summary:
          "Introduces structured ways to think about attackers, assets, and risks in web apps.",
      },
      {
        title: "Paper 2 – Secure Authentication and Session Management",
        summary:
          "Reviews modern practices for passwords, tokens, and multi-factor authentication.",
      },
      {
        title: "Paper 3 – Data Privacy in Analytics Projects",
        summary:
          "Explains anonymization and aggregation techniques that keep data useful but safer.",
      },
      {
        title: "Paper 4 – DevSecOps: Security in the CI/CD Pipeline",
        summary:
          "Shows how to integrate security checks into automated build and deploy pipelines.",
      },
      {
        title: "Paper 5 – Security for AI and ML Systems",
        summary:
          "Covers adversarial attacks, model stealing, and other threats specific to AI services.",
      },
    ],

    "Applied AI": [
      {
        title: "Paper 1 – AI Assistants for Academic Research",
        summary:
          "Describes tools like MOWAKEB that help researchers manage reading, summarizing, and note-taking.",
      },
      {
        title: "Paper 2 – AI in Healthcare Workflows",
        summary:
          "Surveys AI systems that support doctors and nurses with triage, reporting, and patient education.",
      },
      {
        title: "Paper 3 – AI for Education and Personalized Learning",
        summary:
          "Looks at adaptive learning systems that recommend content for each student.",
      },
      {
        title: "Paper 4 – Responsible Deployment of AI Products",
        summary:
          "Provides a checklist to launch AI features safely and monitor their impact.",
      },
      {
        title: "Paper 5 – Measuring Business Impact of AI",
        summary:
          "Explains how to connect ML metrics to real product and business KPIs.",
      },
    ],

    default: [
      {
        title: "Paper 1 – Example title about the topic",
        summary: "Short description of why this paper is relevant.",
      },
      {
        title: "Paper 2 – Example title about the topic",
        summary: "Short description of why this paper is relevant.",
      },
      {
        title: "Paper 3 – Example title about the topic",
        summary: "Short description of why this paper is relevant.",
      },
      {
        title: "Paper 4 – Example title about the topic",
        summary: "Short description of why this paper is relevant.",
      },
      {
        title: "Paper 5 – Example title about the topic",
        summary: "Short description of why this paper is relevant.",
      },
    ],
  };

  const FIELD_SUMMARIES = {
    "Artificial Intelligence (AI)": {
      short:
        "AI in this context focuses on language models and assistants that help researchers search, read, and write scientific material.",
      long:
        "In Artificial Intelligence (AI), MOWAKEB highlights papers on large language models, prompting strategies, evaluation of AI-generated text, and ethical considerations. The goal is to help you use AI as a powerful assistant while staying in control of the scientific reasoning.",
    },
    "Data Science & Analytics": {
      short:
        "Data Science & Analytics is about turning raw data into trustworthy insights and decisions.",
      long:
        "This field covers reproducible pipelines, experimental design, visualization, and forecasting. The selected papers show how to structure analytics projects so that results are reliable, explainable, and directly useful for stakeholders.",
    },
    "Systems & Infrastructure": {
      short:
        "Systems & Infrastructure deals with how to run AI and data workloads reliably at scale.",
      long:
        "Here MOWAKEB surfaces papers on microservices for model serving, observability, cloud cost control, CI/CD for ML, and performance tuning. These topics are essential when moving from prototype models to production systems.",
    },
    "Security & Privacy": {
      short:
        "Security & Privacy focuses on protecting systems, users, and data throughout the AI lifecycle.",
      long:
        "The papers in this field discuss threat modeling, authentication, data protection in analytics, DevSecOps practices, and attacks against ML models. Together they provide a foundation for building trustworthy AI-powered applications.",
    },
    "Applied AI": {
      short:
        "Applied AI is about using machine learning and AI techniques to solve real problems in products and organizations.",
      long:
        "This field includes AI assistants for research, healthcare, education, and business. The highlighted papers show how to design useful AI features, deploy them responsibly, and measure their real-world impact.",
    },
    default: {
      short:
        "This section shows a demo summary for the selected paper and how it relates to your chosen field.",
      long:
        "MOWAKEB would normally receive structured metadata and full text, then generate a clear, structured summary tailored to the field you are exploring.",
    },
  };

  const PAPER_SUMMARIES = {
    "Artificial Intelligence (AI)": {
      "Paper 1 – Large Language Models for Research Assistance": {
        short:
          "This paper introduces large language models as research copilots that can read, summarize, and draft scientific content on demand.",
        long:
          "The authors show how LLMs can speed up literature reviews, generate outlines, rewrite paragraphs in different styles, and answer follow-up questions about a paper. They also discuss limitations such as hallucinations and emphasize that domain experts must always verify claims before using AI-generated text in real research.",
      },
      "Paper 2 – Prompt Engineering for Reliable AI Outputs": {
        short:
          "This paper focuses on how prompt design changes the quality and stability of AI responses.",
        long:
          "It reviews prompt patterns such as role prompting, step-by-step reasoning, and structured outputs. Through experiments, the paper demonstrates that good prompts reduce hallucinations, improve factual accuracy, and make AI tools more predictable for research workflows.",
      },
      "Paper 3 – Evaluating AI-generated Scientific Text": {
        short:
          "This paper explores how to evaluate abstracts and paragraphs produced with the help of AI.",
        long:
          "The authors compare automatic metrics with human expert review and propose a simple checklist: check faithfulness to the source paper, correctness of claims, originality, and clarity. They argue that evaluation must look beyond grammar to the underlying scientific validity.",
      },
      "Paper 4 – Human–AI Collaboration in Academic Writing": {
        short:
          "This work studies how researchers and AI tools can write together effectively.",
        long:
          "Through case studies, the paper describes workflows where the human controls structure, arguments, and citations while AI supports brainstorming, drafting, and editing. It highlights failure modes—such as over-trusting AI suggestions—and offers practical recommendations for safe collaboration.",
      },
      "Paper 5 – Ethical Risks of Generative Models": {
        short:
          "This paper discusses ethical and practical risks when using generative AI in scientific work.",
        long:
          "Key topics include biased outputs, fabricated references, sensitive data leakage, and over-automation of critical thinking. The authors propose guardrails such as disclosure of AI use, human verification, restricted training data, and clear institutional policies.",
      },
    },

    "Data Science & Analytics": {
      "Paper 1 – Building a Reproducible Analytics Pipeline": {
        short:
          "This paper explains how to build analytics pipelines that can be rerun and trusted months later.",
        long:
          "It recommends version-controlling code and data, using configuration files instead of manual parameters, and tracking every experiment with metadata. The result is analytics work that is easier to debug, review, and hand over to other team members.",
      },
      "Paper 2 – Visual Analytics for Decision Makers": {
        short:
          "This paper looks at how to design dashboards that really support decisions instead of just showing charts.",
        long:
          "The authors emphasize choosing a small number of key metrics, adding explanations and annotations, and telling a story from context to insight to recommended action. Real examples show how good dashboards change conversations in product, finance, and operations teams.",
      },
      "Paper 3 – A/B Testing and Experiment Design in Practice": {
        short:
          "This paper provides a practical guide to running online experiments safely.",
        long:
          "It covers sample-size calculation, randomization, guardrail metrics, and common statistical traps such as peeking and p-hacking. The authors show how to turn experiment results into clear yes/no decisions about proposed changes.",
      },
      "Paper 4 – Handling Imbalanced Datasets": {
        short:
          "This work compares methods for models where one class is much rarer than the other.",
        long:
          "Techniques include resampling, synthetic data generation, class-weighted loss functions, and metrics like precision-recall curves. The paper uses fraud detection and churn prediction as running examples and concludes that evaluation choice is as important as the algorithm.",
      },
      "Paper 5 – Time Series Forecasting for Operations": {
        short:
          "This paper shares real-world lessons from forecasting demand and traffic for operations planning.",
        long:
          "The authors discuss feature engineering, seasonality, holidays, and model monitoring after deployment. They stress that communicating forecast uncertainty is critical for teams that use predictions to plan inventory, staffing, or capacity.",
      },
    },

    "Systems & Infrastructure": {
      "Paper 1 – Scalable Microservices for AI Workloads": {
        short:
          "This paper presents architectural patterns for serving AI models as microservices.",
        long:
          "It covers request routing, autoscaling, GPU pooling, and strategies for rolling out new model versions safely. The authors show how these patterns keep latency low even when traffic and model complexity grow.",
      },
      "Paper 2 – Observability for Distributed Systems": {
        short:
          "This work explains how to design observability for complex back-end systems.",
        long:
          "It introduces the pillars of logs, metrics, and traces, and demonstrates how to use them together to debug slow or failing requests. Concrete examples illustrate how a good observability setup shortens incident response time.",
      },
      "Paper 3 – Cost Optimization in Cloud Architectures": {
        short:
          "This paper explores how to reduce cloud spending without sacrificing reliability.",
        long:
          "Recommendations include rightsizing instances, using spot capacity where safe, choosing storage tiers, and regularly reviewing unused resources. The authors provide checklists that teams can apply to their own environments.",
      },
      "Paper 4 – CI/CD for Machine Learning Systems": {
        short:
          "This paper adapts CI/CD practices to the specific needs of ML systems.",
        long:
          "It proposes pipelines that run data quality checks, model validation tests, and performance benchmarks before deployment. The approach helps teams ship new model versions frequently while keeping quality under control.",
      },
      "Paper 5 – Caching and Latency Reduction Techniques": {
        short:
          "This work surveys techniques to make user-facing applications feel faster.",
        long:
          "It explains browser caching, API caching, and edge CDNs, and shows how to combine them with asynchronous processing. Special attention is given to AI inference workloads where model computation is expensive.",
      },
    },

    "Security & Privacy": {
      "Paper 1 – Threat Modeling for Web Applications": {
        short:
          "This paper introduces structured threat-modeling methods for web apps.",
        long:
          "It walks through identifying assets, entry points, and attacker goals, then ranking risks and planning mitigations. Example diagrams help teams apply the process to their own systems.",
      },
      "Paper 2 – Secure Authentication and Session Management": {
        short:
          "This work reviews modern authentication mechanisms and common pitfalls.",
        long:
          "Topics include salted password hashing, OAuth and OpenID Connect, multi-factor authentication, and session fixation attacks. The authors provide practical patterns and anti-patterns for everyday development.",
      },
      "Paper 3 – Data Privacy in Analytics Projects": {
        short:
          "This paper focuses on keeping analytics useful while protecting individuals’ privacy.",
        long:
          "It compares anonymization, pseudonymization, aggregation, and differential privacy. Case studies show how each technique changes the balance between privacy risk and data utility.",
      },
      "Paper 4 – DevSecOps: Security in the CI/CD Pipeline": {
        short:
          "This paper shows how to embed security checks across the software delivery pipeline.",
        long:
          "It covers dependency scanning, static and dynamic analysis, container hardening, and policy-as-code. The main message is that security must be automated and continuous, not a final manual step.",
      },
      "Paper 5 – Security for AI and ML Systems": {
        short:
          "This work looks at attacks and defenses specific to ML models and APIs.",
        long:
          "Examples include adversarial inputs that change model predictions, model stealing via repeated queries, and data-poisoning attacks. The paper ends with guidelines for hardening AI services exposed on the internet.",
      },
    },

    "Applied AI": {
      "Paper 1 – AI Assistants for Academic Research": {
        short:
          "This paper describes AI assistants that support researchers in reading, organizing, and writing.",
        long:
          "Features include automatic paper summarization, smart search over a personal library, question answering, and reading trackers—very similar to what MOWAKEB aims to provide. The paper also discusses user-experience lessons from real deployments.",
      },
      "Paper 2 – AI in Healthcare Workflows": {
        short:
          "This work surveys how AI is integrated into hospital and clinic workflows.",
        long:
          "Use cases include triage, report generation, imaging support, and patient education bots. The authors emphasize human oversight, safety validation, and integration with existing systems such as electronic health records.",
      },
      "Paper 3 – AI for Education and Personalized Learning": {
        short:
          "This paper analyzes AI-driven systems that adapt learning content to each student.",
        long:
          "It covers knowledge tracing models, recommendation of practice exercises, and conversational tutors. The paper highlights both learning gains and fairness concerns when students receive different content.",
      },
      "Paper 4 – Responsible Deployment of AI Products": {
        short:
          "This work proposes a practical checklist for launching AI features responsibly.",
        long:
          "Steps include impact assessment, bias analysis, explainability review, user communication, and post-launch monitoring. The paper provides templates teams can reuse when shipping new AI features.",
      },
      "Paper 5 – Measuring Business Impact of AI": {
        short:
          "This paper connects AI model performance to real business outcomes.",
        long:
          "It explains how to define metrics that link model accuracy to revenue, cost savings, or user satisfaction, and recommends experiment designs to estimate that impact. The authors argue that every AI project should plan for this measurement from day one.",
      },
    },
  };

  function normalizeFieldLabel(label) {
    if (!label) return "Artificial Intelligence (AI)";
    const txt = String(label).toLowerCase();

    if (txt === "ai" || txt.includes("artificial intelligence")) {
      return "Artificial Intelligence (AI)";
    }
    if (txt.includes("data") && txt.includes("analytics")) {
      return "Data Science & Analytics";
    }
    if (txt.includes("system") || txt.includes("infrastructure")) {
      return "Systems & Infrastructure";
    }
    if (txt.includes("security") || txt.includes("privacy")) {
      return "Security & Privacy";
    }
    if (txt.includes("applied")) {
      return "Applied AI";
    }

    return "Artificial Intelligence (AI)";
  }


// Field label to DB field mapping
function mapFieldLabelToDbField(label) {
  const normalized = normalizeFieldLabel(label);

  switch (normalized) {
    case "Artificial Intelligence (AI)":
      return "AI";
    case "Data Science & Analytics":
      return "Data Science";
    case "Systems & Infrastructure":
      return "Systems";
    case "Security & Privacy":
      return "Security";
    case "Applied AI":
      return "Applied AI";
    default:
      //  safe fallback 
      return "AI";
  }
}

// presentation of results from DB papers in results page
async function loadResultsFromDb(fieldLabel) {
  const listEl = document.querySelector(".results-list");

  if (!listEl) {
    console.warn("No .results-list element found");
    return;
  }

  if (typeof supabaseClient === "undefined") {
    console.warn("supabaseClient is not available, falling back to demo data");
    applyDemoPapersForField(fieldLabel);
    return;
  }

  const dbMainField = mapFieldLabelToDbField(fieldLabel);

  try {
    const { data, error } = await supabaseClient
      .from("papers")
      .select("id, title, abstract, sub_field, main_field, stored_html_path, pdf_url, published_at")
      .eq("main_field", dbMainField)
      .order("published_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Error loading papers from Supabase:", error);
      applyDemoPapersForField(fieldLabel);
      return;
    }

    if (!data || data.length === 0) {
      console.log("No papers found for main_field:", dbMainField);
      applyDemoPapersForField(fieldLabel);
      return;
    }

    // empty the list first - fill with new data from database
    listEl.innerHTML = "";

    data.forEach((paper, index) => {
      const li = document.createElement("li");

      const row = document.createElement("div");
      row.className = "paper-row";

      //data attributes for later use on summary page
      row.dataset.paperId = paper.id || "";
      row.dataset.mainField = paper.main_field || "";
      row.dataset.subField = paper.sub_field || "";
      row.dataset.storedHtmlPath = paper.stored_html_path || "";
      row.dataset.pdfUrl = paper.pdf_url || "";
      row.dataset.publishedAt = paper.published_at || "";


      const left = document.createElement("div");

      const h3 = document.createElement("h3");
      const subPrefix = paper.sub_field ? paper.sub_field + " – " : "";
      const titleText = paper.title || `Paper ${index + 1}`;
      h3.textContent = subPrefix + titleText; // sub-field before title

      const p = document.createElement("p");
      p.textContent =
        paper.abstract ||
        "No abstract available yet for this paper.";

      left.appendChild(h3);
      left.appendChild(p);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn secondary-btn summary-btn paper-summary-btn";
      btn.textContent = "View summary";

      row.appendChild(left);
      row.appendChild(btn);
      li.appendChild(row);
      listEl.appendChild(li);
    });
  } catch (err) {
    console.error("Unexpected error loading papers:", err);
    applyDemoPapersForField(fieldLabel);
  }
}


  function applyDemoPapersForField(fieldLabel) {
    const normalized = normalizeFieldLabel(fieldLabel);
    const config =
      DEMO_PAPERS_BY_FIELD[normalized] || DEMO_PAPERS_BY_FIELD.default;

    const rows = document.querySelectorAll(".paper-row");
    rows.forEach((row, index) => {
      const paper = config[index] || config[config.length - 1];
      const titleEl = row.querySelector("h3");
      const descEl = row.querySelector("p");

      if (titleEl && paper.title) {
        titleEl.textContent = paper.title;
      }
      if (descEl && paper.summary) {
        descEl.textContent = paper.summary;
      }
    });
  }




// Results & Summary pages logic


// Helper: get last search (topic + field) safely
function getLastSearch() {
  try {
    const raw = localStorage.getItem(SEARCH_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    return {
      field: obj.field || "Artificial Intelligence (AI)",
      topic: obj.topic || "Recent Papers",
      timestamp: obj.timestamp || null,
    };
  } catch (e) {
    console.warn("Failed to parse SEARCH_KEY", e);
    return null;
  }
}

// Helper: show the generated summary content and hide placeholders
function showSummaryOnlyLong() {
  const placeholder = document.querySelector(".summary-placeholder");
  const content = document.querySelector(".summary-content");

  if (placeholder) placeholder.classList.add("hidden");
  if (content) content.classList.remove("hidden");

  // Hide sections we don't want to show (Short overview / Limitations / Use cases / Copy-ready)
  const hideByParagraphSelector = (selector) => {
    const p = document.querySelector(selector);
    if (!p) return;
    const h = p.previousElementSibling;
    if (h && h.tagName === "H3") h.style.display = "none";
    p.style.display = "none";
  };

  hideByParagraphSelector(".summary-body-short");
  hideByParagraphSelector(".summary-body-limitations");
  hideByParagraphSelector(".summary-body-usecases");
  hideByParagraphSelector(".summary-body-copyready");

  // Rename the "Detailed explanation" heading to "Summary" 
  const longP = document.querySelector(".summary-body-long");
  if (longP) {
    const h = longP.previousElementSibling;
    if (h && h.tagName === "H3") h.textContent = "Summary";
  }
}


// Results list page after search

const resultsPage = document.querySelector('[data-page="results"]');
if (resultsPage) {
  const topicSpan = document.querySelector(".summary-topic");
  const fieldSpan = document.querySelector(".summary-field");

  const last = getLastSearch();



  let fieldLabel = last?.field || "Artificial Intelligence (AI)";


  if (topicSpan) topicSpan.textContent = `Recent papers in ${fieldLabel}`;
  if (fieldSpan) fieldSpan.textContent = fieldLabel;



  // main_field
  // "View summary"
  loadResultsFromDb(fieldLabel).then(() => {
    const paperButtons = document.querySelectorAll(".paper-summary-btn");
    paperButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = btn.closest(".paper-row");
        const titleEl = row ? row.querySelector("h3") : null;
        const title = titleEl ? titleEl.textContent.trim() : "Selected paper";

        const topicText = topicSpan ? topicSpan.textContent : topicLabel;
        const fieldText = fieldSpan ? fieldSpan.textContent : fieldLabel;

         
        const payload = {
          title,
          topic: topicText,
          field: fieldText,
          paperId: row?.dataset.paperId || null,
          mainField: row?.dataset.mainField || null,
          subField: row?.dataset.subField || null,
          storedHtmlPath: row?.dataset.storedHtmlPath || null,
          pdfUrl: row?.dataset.pdfUrl || null,
          publishedAt: row?.dataset.publishedAt || null,
        };


        try {
          localStorage.setItem(SELECTED_PAPER_KEY, JSON.stringify(payload));
        } catch (e) {
          console.warn("Failed to store selected paper", e);
        }

        window.location.href = "summary.html";
      });
    });
  });
}




// Summary page  
const summaryPage = document.querySelector('[data-page="summary"]');
if (summaryPage) {
  // Header elements
  const topicSpan = document.querySelector(".summary-topic");
  const fieldSpan = document.querySelector(".summary-field");
  const selectedTitleSpan = document.querySelector(".summary-selected-title");
  const summaryDateEl = document.querySelector(".summary-date");
  const summaryPdfLinkEl = document.querySelector(".summary-pdf-link");

  const longBodyEl = document.querySelector(".summary-body-long");
  const fullHtmlContainer = document.getElementById("full-html-summary");

  let lastSummaryText = "";
  let selected = null;

  // 1) Load last search info (field/topic) as default
  const last = getLastSearch();
  let fieldLabel = last?.field || "Artificial Intelligence (AI)";
  let topicText = last?.topic || "Top 5 papers";

  if (topicSpan) topicSpan.textContent = topicText;
  if (fieldSpan) fieldSpan.textContent = fieldLabel;

  // 2) Read selected paper payload from localStorage
  let selectedPaperTitle = null;
  let storedHtmlPath = null;
  let pdfUrl = null;
  let publishedAtRaw = null;

  try {
    const rawSelected = localStorage.getItem(SELECTED_PAPER_KEY);
    if (rawSelected) {
      selected = JSON.parse(rawSelected);

      if (selected?.title) selectedPaperTitle = selected.title;

      if (selected?.topic) {
        topicText = selected.topic;
        if (topicSpan) topicSpan.textContent = topicText;
      }

      if (selected?.field) {
        fieldLabel = selected.field;
        if (fieldSpan) fieldSpan.textContent = fieldLabel;
      }

      storedHtmlPath = selected?.storedHtmlPath || null;
      pdfUrl = selected?.pdfUrl || null;
      publishedAtRaw = selected?.publishedAt || null;
    }
  } catch (e) {
    console.warn("Failed to parse SELECTED_PAPER_KEY on summary page", e);
  }

  const normalizedField = normalizeFieldLabel(fieldLabel);

  // 3) Fallback title if nothing was stored
  if (!selectedPaperTitle) {
    const list = DEMO_PAPERS_BY_FIELD[normalizedField] || DEMO_PAPERS_BY_FIELD.default;
    selectedPaperTitle = list?.[0]?.title || "Selected paper";
  }

  if (selectedTitleSpan) selectedTitleSpan.textContent = selectedPaperTitle;

  // 4) Small meta line: date + PDF link
  if (summaryDateEl) {
    if (publishedAtRaw) {
      const d = new Date(publishedAtRaw);
      if (!isNaN(d)) {
        const formatted = d.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        summaryDateEl.textContent = `Published: ${formatted}`;
      } else {
        summaryDateEl.textContent = "";
      }
    } else {
      summaryDateEl.textContent = "";
    }
  }

  if (summaryPdfLinkEl) {
    if (pdfUrl) {
      summaryPdfLinkEl.href = pdfUrl;
      summaryPdfLinkEl.style.display = "inline";
    } else {
      summaryPdfLinkEl.style.display = "none";
    }
  }

  // 5) Short text summary (used also for TTS as fallback)
  const fieldCfg = FIELD_SUMMARIES[normalizedField] || FIELD_SUMMARIES.default;
  const perFieldMap = PAPER_SUMMARIES[normalizedField] || {};
  const paperCfg = perFieldMap[selectedPaperTitle];

  let mainText = "";
  if (paperCfg && (paperCfg.long || paperCfg.short)) mainText = (paperCfg.long || paperCfg.short).trim();
  else if (fieldCfg && (fieldCfg.long || fieldCfg.short)) mainText = (fieldCfg.long || fieldCfg.short).trim();
  else mainText = "This is a demo summary for the selected paper in the chosen field.";

  if (longBodyEl) longBodyEl.textContent = mainText;
  lastSummaryText = mainText;

  // Always show long summary view
  showSummaryOnlyLong();

    // 6) Load full HTML summary from Supabase Storage
  async function loadFullHtmlSummary() {
    if (!fullHtmlContainer) return;

    if (!storedHtmlPath) {
      fullHtmlContainer.textContent =
        "The detailed summary for this paper is not available yet.";
      return;
    }

    if (typeof supabaseClient === "undefined") {
      fullHtmlContainer.textContent =
        "Cannot load the full summary right now. Please try again later.";
      return;
    }

    try {
      const { data, error } = supabaseClient.storage
        .from("html_files_results")
        .getPublicUrl(storedHtmlPath);

      if (error || !data?.publicUrl) {
        console.error("Error getting public URL for HTML summary:", error);
        fullHtmlContainer.textContent =
          "Could not load the full summary for this paper.";
        return;
      }

      const response = await fetch(data.publicUrl);
      if (!response.ok) {
        console.error("Error fetching HTML summary:", response.status);
        fullHtmlContainer.textContent =
          "Could not fetch the full summary. Please try again later.";
        return;
      }

      const htmlText = await response.text();

      const parser = new DOMParser();
      const parsed = parser.parseFromString(htmlText, "text/html");
      const body = parsed.body;

      // from introduction heading to the end
      let contentRoot = body;
      const headings = body.querySelectorAll("h1, h2, h3");
      let introHeading = null;

      headings.forEach((h) => {
        if (
          !introHeading &&
          h.textContent.trim().toLowerCase().startsWith("introduction")
        ) {
          introHeading = h;
        }
      });

      if (introHeading) {
        const fragment = document.createElement("div");
        let node = introHeading;
        while (node) {
          const next = node.nextSibling;
          fragment.appendChild(node);
          node = next;
        }
        contentRoot = fragment;
      }

      const plainText = (contentRoot.textContent || "").trim();
      if (plainText) {
        // Keep first 8000 characters for TTS use
        lastSummaryText = plainText.slice(0, 8000);
      }

      fullHtmlContainer.innerHTML = contentRoot.innerHTML;
    } catch (err) {
      console.error("Unexpected error loading HTML summary:", err);
      fullHtmlContainer.textContent =
        "Unexpected error while loading the summary. Please try again.";
    }
  }

  loadFullHtmlSummary();



   // Action buttons
  const pdfBtn = document.getElementById("download-pdf-btn");
  const audioBtn = document.getElementById("play-audio-btn");
  const discussBtn = document.getElementById("discuss-ai-btn");
  const sendToTrackerBtn = document.getElementById("send-to-tracker-btn");

  // Make sure buttons are enabled (HTML might have disabled in older versions)
  [pdfBtn, audioBtn, discussBtn, sendToTrackerBtn].forEach((btn) => {
    if (!btn) return;
    btn.removeAttribute("disabled");
    btn.setAttribute("aria-disabled", "false");
  });

  // PDF: simplest reliable approach is browser print-to-PDF
  if (pdfBtn) {
    pdfBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.print();
    });
  }

  // Discuss with AI →  opens chatbot page in new tab
  if (discussBtn) {
    discussBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(CHAT_URL, "_blank", "noopener");
    });
  }


  // Audio (TTS)
let isPlaying = false;
let isLoadingAudio = false;
let currentAudio = null;

function updateAudioIcon() {
  if (!audioBtn) return;
  const iconSpan = audioBtn.querySelector(".audio-icon");
  if (!iconSpan) return;

  const state = audioBtn.dataset.state || "play";

  if (state === "play") {
    iconSpan.textContent = "▶";              
    audioBtn.setAttribute("aria-label", "Play summary audio");
  } else if (state === "pause") {
    iconSpan.textContent = "⏸";            
    audioBtn.setAttribute("aria-label", "Pause summary audio");
  }
}

function resetAudioState() {
  if (currentAudio) {
    try { currentAudio.pause(); } catch (e) {}
    currentAudio = null;
  }
  isPlaying = false;
  isLoadingAudio = false;
  if (audioBtn) {
    audioBtn.dataset.state = "play";
    updateAudioIcon();   
  }
}

async function handleAudioClick(e) {
  e.preventDefault();
  if (!audioBtn) return;
  if (isLoadingAudio) return;

 
  if (isPlaying && currentAudio) {
    resetAudioState();
    return;
  }

  const text = (lastSummaryText || "").trim();
  if (!text) return;

  try {
    isLoadingAudio = true;

    const response = await fetch(TTS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) throw new Error("TTS API returned non-OK status.");

    const data = await response.json();
    if (!data?.audioContent) throw new Error("TTS API: missing audioContent.");

    const audioBytes = atob(data.audioContent);
    const buffer = new Uint8Array(audioBytes.length);
    for (let i = 0; i < audioBytes.length; i++) {
      buffer[i] = audioBytes.charCodeAt(i);
    }

    const blob = new Blob([buffer], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);

    if (currentAudio) {
      try { currentAudio.pause(); } catch (e) {}
    }

    currentAudio = new Audio(url);
    currentAudio.addEventListener("ended", () => {
      resetAudioState();
      URL.revokeObjectURL(url);
    });

    isLoadingAudio = false;
    isPlaying = true;
    audioBtn.dataset.state = "pause";
    updateAudioIcon();         
    await currentAudio.play();
  } catch (err) {
    console.error("Error while playing audio", err);
    alert("Audio failed to play. Please check the API / network and try again.");
    resetAudioState();
  }
}

if (audioBtn) {
  audioBtn.dataset.state = "play";
  updateAudioIcon();           
  audioBtn.addEventListener("click", handleAudioClick);
}

  // Send to tracker
  if (sendToTrackerBtn) {
    sendToTrackerBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!selectedPaperTitle) return;

      const user = getUser();
      const topicTextCurrent = topicSpan ? topicSpan.textContent : (last?.topic || "");
      const fieldTextCurrent = fieldSpan ? fieldSpan.textContent : fieldLabel;

      // Always save locally so the tracker page can render immediately
      let favs = [];
      const rawFavs = localStorage.getItem(FAV_KEY);
      if (rawFavs) {
        try { favs = JSON.parse(rawFavs) || []; } catch (err) { favs = []; }
      }

      favs.push({
        title: selectedPaperTitle,
        topic: topicTextCurrent,
        field: fieldTextCurrent,
        status: "to-read",
        notes: "Added from summary page.",
      });

      localStorage.setItem(FAV_KEY, JSON.stringify(favs));

      // Try saving to Supabase (if logged in)
      try {
        if (user && user.email) {
          await dbAddTrackerEntry({
            ownerEmail: user.email,
            authUserId: user.id,
            paperTitle: selectedPaperTitle,
            topic: topicTextCurrent,
            field: fieldTextCurrent,
            status: "to-read",
            notes: "Added from summary page.",
          });
        }
      } catch (err) {
        console.error("Error while saving tracker entry", err);
      }

      window.location.href = "tracking.html";
    });
  }
}
// PDF Chatbot page
const chatbotLayout = document.querySelector(".chatbot-layout");
if (chatbotLayout) {
  
  const uploadForm    = document.getElementById("pdf-upload-form");
  const pdfInput      = document.getElementById("pdf-file");
  const statusEl      = document.getElementById("pdf-status");
  const messagesBox   = document.getElementById("chatbot-messages");
  const questionForm  = document.getElementById("question-form");
  const questionInput = document.getElementById("question-input");
const pdfIconBtn = document.getElementById("pdf-icon-btn");

if (pdfIconBtn && pdfInput) {
  pdfIconBtn.addEventListener("click", () => {
    pdfInput.click();
  });

  
  pdfInput.addEventListener("change", () => {
    if (pdfInput.files && pdfInput.files.length > 0 && uploadForm) {
      uploadForm.requestSubmit();   
    }
  });
}
  
  if (
    !uploadForm ||
    !pdfInput ||
    !statusEl ||
    !messagesBox ||
    !questionForm ||
    !questionInput
  ) {
    console.warn("Chatbot elements not found on this page.");
    return;
  }

  let pdfUploaded = false;

  function addMessage(sender, text) {
    const div = document.createElement("div");
    div.className =
      sender === "user" ? "chat-msg chat-msg-user" : "chat-msg chat-msg-bot";
    div.textContent = text;
    messagesBox.appendChild(div);
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }

  
  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!pdfInput.files || pdfInput.files.length === 0) {
      alert("Please choose a PDF file first.");
      return;
    }

    const file = pdfInput.files[0];
    const formData = new FormData();
    formData.append("file", file);

    statusEl.textContent = "Uploading PDF...";

    try {
      const res = await fetch(`${CHATBOT_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();
      console.log("Upload response:", data);
      pdfUploaded = true;
      statusEl.textContent = "PDF uploaded. You can start asking questions.";
    } catch (err) {
      console.error(err);
      pdfUploaded = false;
      statusEl.textContent =
        "Error uploading PDF. Please try again later.";
    }
  });


questionForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const question = (questionInput.value || "").trim();
  if (!question) return;

  if (!pdfUploaded) {
    alert("Please upload a PDF first.");
    return;
  }

  addMessage("user", question);
  questionInput.value = "";
  addMessage("bot", "Thinking...");

  try {
    
    const url = `${CHATBOT_BASE_URL}/ask`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }), 
    });

    const rawText = await res.text();
    console.log("Ask raw response:", res.status, rawText);

   
    const lastMsg = messagesBox.lastElementChild;
    if (lastMsg && lastMsg.classList.contains("chat-msg-bot")) {
      messagesBox.removeChild(lastMsg);
    }

    if (!res.ok) {
      addMessage(
        "bot",
        "Error from server while answering your question. Please try again."
      );
      return;
    }

    let answer = "";

    
    try {
      const parsed = JSON.parse(rawText);

      if (typeof parsed === "string") {
        answer = parsed;
      } else if (parsed.answer) {
        answer = parsed.answer;
      } else if (parsed.response) {
        answer = parsed.response;
      } else if (parsed.result) {
        answer = parsed.result;
      } else if (parsed.msg) {
        answer = parsed.msg;
      } else {
        answer = rawText || "No answer returned.";
      }
    } catch (jsonErr) {
      
      answer = rawText || "No answer returned.";
    }

    addMessage("bot", answer);
  } catch (err) {
    console.error("Ask error:", err);

    const lastMsg = messagesBox.lastElementChild;
    if (lastMsg && lastMsg.classList.contains("chat-msg-bot")) {
      messagesBox.removeChild(lastMsg);
    }

    addMessage(
      "bot",
      "Error while contacting the chatbot. Please try again later."
    );
  }
});
}
}); 
