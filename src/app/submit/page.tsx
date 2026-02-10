"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { compressImage, validateImageFile } from "@/lib/imageUtils";
import {
  validateSubmissionForm,
  type SubmissionFormData,
  type FormErrors,
} from "@/lib/validation";
import toast from "react-hot-toast";

export default function SubmitPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmission, setHasSubmission] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [formData, setFormData] = useState<SubmissionFormData>({
    fullName: "",
    phoneNumber: "",
    location: "",
    email: "",
    hobbies: "",
    profilePicture: null,
    sourceCode: null,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [profilePreview, setProfilePreview] = useState<string | null>(null);

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

      if (profileError || profile.role !== "developer") {
        toast.error("Access denied. Developer credentials required.");
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }

      setUserId(user.id);

      // Check if user already has a submission
      const { data: existingSubmission } = await supabase
        .from("submissions")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (existingSubmission) {
        setHasSubmission(true);
      }

      setLoading(false);
    } catch (error) {
      console.error("Auth check error:", error);
      router.push("/login");
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleProfilePictureChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrors((prev) => ({ ...prev, profilePicture: validation.error }));
      return;
    }

    setFormData((prev) => ({ ...prev, profilePicture: file }));
    setErrors((prev) => ({ ...prev, profilePicture: undefined }));

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSourceCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".zip")) {
      setErrors((prev) => ({
        ...prev,
        sourceCode: "File must be a .zip file",
      }));
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        sourceCode: "File must be less than 50MB",
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, sourceCode: file }));
    setErrors((prev) => ({ ...prev, sourceCode: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const validationErrors = validateSubmissionForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Please fix the errors in the form");
      return;
    }

    setSubmitting(true);

    try {
      if (!userId) {
        toast.error("User not authenticated");
        return;
      }

      // Compress and upload profile picture
      toast.loading("Compressing profile picture...");
      const compressedImage = await compressImage(formData.profilePicture!);

      const imageExt = compressedImage.name.split(".").pop();
      const imagePath = `${userId}/profile.${imageExt}`;

      const { error: imageUploadError } = await supabase.storage
        .from("profile-pictures")
        .upload(imagePath, compressedImage, { upsert: true });

      if (imageUploadError) {
        throw new Error("Failed to upload profile picture");
      }

      const { data: imageUrlData } = supabase.storage
        .from("profile-pictures")
        .getPublicUrl(imagePath);

      // Upload source code
      toast.loading("Uploading source code...");
      const codeExt = formData.sourceCode!.name.split(".").pop();
      const codePath = `${userId}/source-code.${codeExt}`;

      const { error: codeUploadError } = await supabase.storage
        .from("source-code")
        .upload(codePath, formData.sourceCode!, { upsert: true });

      if (codeUploadError) {
        throw new Error("Failed to upload source code");
      }

      const { data: codeUrlData } = supabase.storage
        .from("source-code")
        .getPublicUrl(codePath);

      // Insert submission
      toast.loading("Saving submission...");
      const { error: submissionError } = await supabase
        .from("submissions")
        .insert({
          user_id: userId,
          full_name: formData.fullName.trim(),
          phone_number: formData.phoneNumber.trim(),
          location: formData.location.trim(),
          email: formData.email.trim(),
          hobbies: formData.hobbies.trim(),
          profile_picture_url: imageUrlData.publicUrl,
          source_code_url: codeUrlData.publicUrl,
          status: "pending",
        });

      if (submissionError) {
        throw new Error("Failed to save submission");
      }

      toast.dismiss();
      toast.success("Submission successful! 🎉");
      setHasSubmission(true);
    } catch (error: any) {
      console.error("Submission error:", error);
      toast.dismiss();
      toast.error(error.message || "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
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

  if (hasSubmission) {
    return (
      <div className="page-container">
        <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 py-12 flex items-center justify-center">
          <div className="w-full max-w-md text-center animate-slide-up">
            <div className="card-glass rounded-2xl p-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <svg
                  className="w-8 h-8 text-primary text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              <h2 className="text-2xl font-bold mb-4 text-white">
                Submission Received!
              </h2>

              <p className="text-muted-foreground mb-6 text-white">
                Thank you for submitting your application. Our team will review
                your submission and get back to you soon.
              </p>

              <button
                onClick={handleLogout}
                className="btn-outline text-white hover:text-gray-300 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Developer Submission
            </h1>
            <p className="text-slate-400 mt-1">
              Complete the form below to submit your application
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="text-sm text-slate-400 hover:text-white transition"
          >
            Logout
          </button>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl p-8 space-y-10"
        >
          {/* ===== Personal Info ===== */}
          <section className="space-y-6">
            <h2 className="text-lg font-semibold text-white">
              Personal Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name */}
              <div>
                <label className="text-sm text-slate-300">Full Name *</label>
                <input
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  disabled={submitting}
                  className="mt-1 w-full rounded-lg bg-slate-900/70 border border-slate-700 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="John Doe"
                />
                {errors.fullName && (
                  <p className="text-red-400 text-xs mt-1">{errors.fullName}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="text-sm text-slate-300">Phone Number *</label>
                <input
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  disabled={submitting}
                  className="mt-1 w-full rounded-lg bg-slate-900/70 border border-slate-700 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="+1 555 123 4567"
                />
                {errors.phoneNumber && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.phoneNumber}
                  </p>
                )}
              </div>

              {/* Location */}
              <div>
                <label className="text-sm text-slate-300">Location *</label>
                <input
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  disabled={submitting}
                  className="mt-1 w-full rounded-lg bg-slate-900/70 border border-slate-700 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="City, Country"
                />
                {errors.location && (
                  <p className="text-red-400 text-xs mt-1">{errors.location}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="text-sm text-slate-300">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={submitting}
                  className="mt-1 w-full rounded-lg bg-slate-900/70 border border-slate-700 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="john@example.com"
                />
                {errors.email && (
                  <p className="text-red-400 text-xs mt-1">{errors.email}</p>
                )}
              </div>
            </div>
          </section>

          {/* ===== About ===== */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">About You</h2>

            <div>
              <label className="text-sm text-slate-300">
                What do you like to do outside coding? *
              </label>
              <textarea
                name="hobbies"
                value={formData.hobbies}
                onChange={handleInputChange}
                disabled={submitting}
                className="mt-1 w-full min-h-35 rounded-lg bg-slate-900/70 border border-slate-700 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Be honest — we care about personality."
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>{formData.hobbies.length} / 1000</span>
                {errors.hobbies && (
                  <span className="text-red-400">{errors.hobbies}</span>
                )}
              </div>
            </div>
          </section>

          {/* ===== Files ===== */}
          <section className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Files</h2>

            {/* Profile Picture */}
            <div className="space-y-2">
              <label className="label text-white">
                Profile Picture <span className="text-red-500">*</span>
              </label>

              <div className="flex items-start gap-4 rounded-xl border border-dashed border-border p-4 text-white">
                {profilePreview ? (
                  <img
                    src={profilePreview}
                    alt="Profile preview"
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-sm">
                    Preview
                  </div>
                )}

                <div className="flex-1">
                  <input
                    id="profilePicture"
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePictureChange}
                    className="input-field"
                    disabled={submitting}
                  />

                  <p className="text-xs text-muted-foreground mt-1">
                    JPG or PNG • Max 20MB
                    <br />
                    Automatically compressed to 1MB (1080px)
                  </p>
                </div>
              </div>

              {errors.profilePicture && (
                <p className="error-message">{errors.profilePicture}</p>
              )}
            </div>

            {/* Source Code */}
            {/* Source Code */}
            <div className="space-y-2">
              <label className="label text-white">
                Project Source Code <span className="text-red-500">*</span>
              </label>

              <div className="rounded-xl border border-dashed border-border p-4 space-y-2 text-white">
                <input
                  id="sourceCode"
                  type="file"
                  accept=".zip"
                  onChange={handleSourceCodeChange}
                  className="input-field"
                  disabled={submitting}
                />

                {formData.sourceCode ? (
                  <p className="text-sm text-green-600">
                    ✅ Selected: <strong>{formData.sourceCode.name}</strong>(
                    {(formData.sourceCode.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Upload a <strong>.zip</strong> containing your project
                    source code
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  • Max size: 50MB
                  <br />
                  • Include README if possible
                  <br />• No node_modules needed
                </p>
              </div>

              {errors.sourceCode && (
                <p className="error-message">{errors.sourceCode}</p>
              )}
            </div>
          </section>

          {/* Submit */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 py-3 font-semibold text-white transition disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
