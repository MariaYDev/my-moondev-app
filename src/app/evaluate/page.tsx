"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

interface Submission {
  id: string;
  user_id: string;
  full_name: string;
  phone_number: string;
  location: string;
  email: string;
  hobbies: string;
  profile_picture_url: string;
  source_code_url: string;
  status: "pending" | "accepted" | "rejected";
  feedback: string | null;
  created_at: string;
}

export default function EvaluatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] =
    useState<Submission | null>(null);
  const [feedback, setFeedback] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || profile.role !== "evaluator") {
        toast.error("Access denied. Evaluator credentials required.");
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }

      await loadSubmissions();
      subscribeToSubmissions();
    } catch (error) {
      console.error("Auth check error:", error);
      router.push("/login");
    }
  };

  const loadSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Failed to load submissions");
        return;
      }

      setSubmissions(data || []);
      setLoading(false);
    } catch (error) {
      console.error("Error loading submissions:", error);
      toast.error("Failed to load submissions");
      setLoading(false);
    }
  };

  const subscribeToSubmissions = () => {
    const channel = supabase
      .channel("submissions-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "submissions",
        },
        () => {
          loadSubmissions();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSelectSubmission = (submission: Submission) => {
    setSelectedSubmission(submission);
    setFeedback(submission.feedback || "");
  };

  const handleDownloadSourceCode = (url: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDecision = async (decision: "accepted" | "rejected") => {
    if (!selectedSubmission) return;

    if (!feedback.trim()) {
      toast.error("Please provide feedback before making a decision");
      return;
    }

    setProcessing(true);

    try {
      // Update submission
      const { error: updateError } = await supabase
        .from("submissions")
        .update({
          status: decision,
          feedback: feedback.trim(),
        })
        .eq("id", selectedSubmission.id);

      if (updateError) {
        throw new Error("Failed to update submission");
      }

      // Send email notification
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: selectedSubmission.email,
          name: selectedSubmission.full_name,
          decision,
          feedback: feedback.trim(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Email API error:", errorText);
      }

      toast.success(
        decision === "accepted"
          ? "Candidate accepted! 🎉"
          : "Decision recorded.",
      );

      setSelectedSubmission(null);
      setFeedback("");
      await loadSubmissions();
    } catch (error: any) {
      console.error("Decision error:", error);
      toast.error(error.message || "Failed to process decision");
    } finally {
      setProcessing(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">
          <p className="text-lg text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 py-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Evaluator Dashboard
            </h1>
            <p className="text-slate-400 mt-1">
              Review and evaluate developer submissions
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="text-sm text-slate-400 hover:text-white transition"
          >
            Logout
          </button>
        </div>

        {submissions.length === 0 ? (
          <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/10 mb-4">
              <svg
                className="w-8 h-8 text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              No Submissions Yet
            </h2>
            <p className="text-slate-400">
              Submissions will appear here when developers apply
            </p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* ===== Submissions List ===== */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">
                Submissions ({submissions.length})
              </h2>

              <div className="space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
                {submissions.map((submission) => (
                  <button
                    key={submission.id}
                    onClick={() => handleSelectSubmission(submission)}
                    className={`w-full text-left rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 p-4 transition hover:border-indigo-500/50 ${
                      selectedSubmission?.id === submission.id
                        ? "ring-2 ring-indigo-500"
                        : ""
                    }`}
                  >
                    <div className="flex gap-3">
                      <img
                        src={submission.profile_picture_url}
                        alt={submission.full_name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">
                          {submission.full_name}
                        </h3>
                        <p className="text-sm text-slate-400 truncate">
                          {submission.location}
                        </p>

                        <div className="mt-2">
                          {submission.status === "pending" && (
                            <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400">
                              Pending
                            </span>
                          )}
                          {submission.status === "accepted" && (
                            <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400">
                              Accepted
                            </span>
                          )}
                          {submission.status === "rejected" && (
                            <span className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-400">
                              Rejected
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ===== Details ===== */}
            <div className="lg:col-span-2">
              {selectedSubmission ? (
                <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl p-8">
                  {/* Profile */}
                  <div className="flex gap-6 mb-8">
                    <img
                      src={selectedSubmission.profile_picture_url}
                      alt={selectedSubmission.full_name}
                      className="w-32 h-32 rounded-xl object-cover"
                    />

                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-white mb-2">
                        {selectedSubmission.full_name}
                      </h2>

                      <div className="text-sm text-slate-400 space-y-1">
                        <p>📧 {selectedSubmission.email}</p>
                        <p>📱 {selectedSubmission.phone_number}</p>
                        <p>📍 {selectedSubmission.location}</p>
                      </div>
                    </div>
                  </div>

                  {/* Hobbies */}
                  <div className="mb-6">
                    <h3 className="text-white font-semibold mb-2">
                      About the candidate
                    </h3>
                    <p className="text-slate-400 whitespace-pre-wrap">
                      {selectedSubmission.hobbies}
                    </p>
                  </div>

                  {/* Source Code */}
                  <div className="mb-6">
                    <h3 className="text-white font-semibold mb-2">
                      Source Code
                    </h3>
                    <button
                      onClick={() =>
                        handleDownloadSourceCode(
                          selectedSubmission.source_code_url,
                          `${selectedSubmission.full_name}-source-code.zip`,
                        )
                      }
                      className="rounded-lg border border-slate-700 px-4 py-2 text-slate-300 hover:border-indigo-500 hover:text-white transition"
                    >
                      Download ZIP
                    </button>
                  </div>

                  {/* Feedback */}
                  <div className="mb-6">
                    <label className="text-sm text-slate-300">Feedback *</label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      disabled={
                        processing || selectedSubmission.status !== "pending"
                      }
                      className="mt-1 w-full min-h-30 rounded-lg bg-slate-900/70 border border-slate-700 px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500"
                      placeholder="Provide clear and constructive feedback..."
                    />
                  </div>

                  {/* Actions */}
                  {selectedSubmission.status === "pending" && (
                    <div className="flex gap-4">
                      <button
                        onClick={() => handleDecision("accepted")}
                        disabled={processing || !feedback.trim()}
                        className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-3 font-semibold text-white transition disabled:opacity-60"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDecision("rejected")}
                        disabled={processing || !feedback.trim()}
                        className="flex-1 rounded-xl bg-red-600/80 hover:bg-red-600 py-3 font-semibold text-white transition disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-12 text-center">
                  <h2 className="text-xl font-semibold text-white mb-2">
                    Select a Submission
                  </h2>
                  <p className="text-slate-400">
                    Choose a submission from the left to review
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
