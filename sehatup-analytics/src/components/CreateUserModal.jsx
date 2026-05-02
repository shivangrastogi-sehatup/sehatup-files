// src/components/CreateUserModal.jsx
import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import {
  X,
  UserPlus,
  Calendar,
  Activity,
  Ruler,
  Target,
  Heart,
  User,
  Sparkles,
  Scale,
  Check,
  ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES = [
  {
    id: "Men's Sexual Wellness",
    qid: "mens-wellness",
    label: "Men's Wellness",
    sub: "Sexual health questionnaire",
    icon: User,
    color: "#06b6d4",
  },
  {
    id: "Women's Wellness",
    qid: "womens-wellness",
    label: "Women's Wellness",
    sub: "Wellness questionnaire",
    icon: Heart,
    color: "#f43f5e",
  },
  {
    id: "Men's Weight Management",
    qid: "mens-weight",
    label: "Men's Weight",
    sub: "Weight management plan",
    icon: Scale,
    color: "#8b5cf6",
  },
  {
    id: "Women's Weight Management",
    qid: "womens-weight",
    label: "Women's Weight",
    sub: "Weight management plan",
    icon: Scale,
    color: "#10b981",
  },
];

const initialForm = {
  name: "",
  phone: "",
  dob: "",
  reportCategory: "",
  height: "",
  currentWeight: "",
  targetWeight: "",
  gender: "",
};

export default function CreateUserModal({ isOpen, onClose, onUserCreated, mode }) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(initialForm);

  const isWeight = formData.reportCategory.toLowerCase().includes("weight");
  const today = new Date().toISOString().slice(0, 10);

  const reset = () => {
    setStep(1);
    setFormData(initialForm);
  };

  const close = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.reportCategory || loading) return;
    setLoading(true);
    try {
      const selectedCat = CATEGORIES.find(c => c.id === formData.reportCategory);
      const name = formData.name.trim();
      const phone = formData.phone;
      const dob = formData.dob;
      const h = isWeight ? Number(formData.height) : null;
      const cw = isWeight ? Number(formData.currentWeight) : null;
      const tw = isWeight ? Number(formData.targetWeight) : null;

      const submissionData = {
        // Core Identity
        name: name,
        userName: name,
        phone: phone,
        dob: dob,
        gender: formData.gender,
        
        // Metadata
        source: "doctor_panel",
        status: "Created by Doctor",
        reportCategory: formData.reportCategory,
        questionnaireId: selectedCat?.qid || "unknown",
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        mode: mode || 'live',
        
        // Health Data
        height: h,
        currentWeight: cw,
        targetWeight: tw
      };

      const docRef = await addDoc(
        collection(db, "manual_submissions"),
        submissionData
      );
      
      onUserCreated({ id: docRef.id, ...submissionData });
      reset();
      onClose();
    } catch (error) {
      console.error("Error creating user:", error);
      alert("Failed to create user: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedCat = CATEGORIES.find((c) => c.id === formData.reportCategory);

  return (
    <AnimatePresence>
      <div className="cum-overlay" onClick={close}>
        <motion.div
          className="cum-card"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="cum-header">
            <div className="cum-header-text">
              <div className="cum-eyebrow">
                <Sparkles size={11} /> New Patient
              </div>
              <h2 className="cum-title">
                {step === 1 ? "Choose questionnaire" : "Patient details"}
              </h2>
              <p className="cum-sub">
                {step === 1
                  ? "Pick the program to start the patient on."
                  : "Saved as a partial submission. Patient can complete the rest later."}
              </p>
            </div>
            <button
              onClick={close}
              className="cum-close"
              type="button"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="cum-steps">
            <div className={`cum-step ${step >= 1 ? "active" : ""}`}>
              <span className="cum-step-num">
                {step > 1 ? <Check size={12} /> : "1"}
              </span>
              Category
            </div>
            <div className="cum-step-divider" />
            <div className={`cum-step ${step >= 2 ? "active" : ""}`}>
              <span className="cum-step-num">2</span>
              Details
            </div>
          </div>

          {step === 1 && (
            <div className="cum-body">
              <div className="cum-cat-grid">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const selected = formData.reportCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={`cum-cat-card ${selected ? "selected" : ""}`}
                      style={{ "--cat-color": cat.color }}
                      onClick={() => {
                        const detectedGender = cat.id.toLowerCase().includes("women") ? "Female" : 
                                              cat.id.toLowerCase().includes("men") ? "Male" : "";
                        setFormData({ ...formData, reportCategory: cat.id, gender: detectedGender });
                        setStep(2);
                      }}
                    >
                      <div className="cum-cat-icon">
                        <Icon size={18} />
                      </div>
                      <div className="cum-cat-text">
                        <div className="cum-cat-label">{cat.label}</div>
                        <div className="cum-cat-sub">{cat.sub}</div>
                      </div>
                      <div className="cum-cat-check">
                        {selected && <Check size={12} />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="cum-actions">
                <button type="button" onClick={close} className="btn ghost">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="cum-body">
              {selectedCat && (
                <div
                  className="cum-cat-pill"
                  style={{ "--cat-color": selectedCat.color }}
                >
                  <selectedCat.icon size={14} />
                  <span>{selectedCat.label}</span>
                  <button
                    type="button"
                    className="cum-cat-pill-edit"
                    onClick={() => setStep(1)}
                  >
                    Change
                  </button>
                </div>
              )}

              <div className="cum-form">
                <div className="cum-field cum-field-full">
                  <label>Patient name</label>
                  <div className="cum-input">
                    <User size={15} className="cum-input-icon" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rohan Sharma"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="cum-field">
                  <label>Phone</label>
                  <div className="cum-input">
                    <span className="cum-input-prefix">+91</span>
                    <input
                      type="tel"
                      required
                      inputMode="numeric"
                      placeholder="10-digit number"
                      maxLength="10"
                      pattern="[0-9]{10}"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          phone: e.target.value.replace(/\D/g, ""),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="cum-field">
                  <label>Gender</label>
                  <div className="cum-input">
                    <User size={15} className="cum-input-icon" />
                    <select
                      required
                      value={formData.gender}
                      onChange={(e) =>
                        setFormData({ ...formData, gender: e.target.value })
                      }
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: "none",
                        color: "#fff",
                        fontSize: "14px",
                        outline: "none",
                        cursor: "pointer",
                        height: "100%",
                      }}
                    >
                      <option value="" disabled style={{ color: "#000" }}>
                        Select gender
                      </option>
                      <option value="Male" style={{ color: "#000" }}>
                        Male
                      </option>
                      <option value="Female" style={{ color: "#000" }}>
                        Female
                      </option>
                      <option value="Other" style={{ color: "#000" }}>
                        Other
                      </option>
                    </select>
                  </div>
                </div>

                <div className="cum-field">
                  <label>Date of birth</label>
                  <div className="cum-input">
                    <Calendar size={15} className="cum-input-icon" />
                    <input
                      type="date"
                      required
                      max={today}
                      value={formData.dob}
                      onChange={(e) =>
                        setFormData({ ...formData, dob: e.target.value })
                      }
                    />
                  </div>
                </div>

                {isWeight && (
                  <>
                    <div className="cum-field">
                      <label>Height (cm)</label>
                      <div className="cum-input">
                        <Ruler size={15} className="cum-input-icon" />
                        <input
                          type="number"
                          required
                          inputMode="numeric"
                          placeholder="170"
                          value={formData.height}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              height: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="cum-field">
                      <label>Current weight (kg)</label>
                      <div className="cum-input">
                        <Activity size={15} className="cum-input-icon" />
                        <input
                          type="number"
                          required
                          inputMode="numeric"
                          placeholder="80"
                          value={formData.currentWeight}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              currentWeight: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="cum-field cum-field-full">
                      <label>Target weight (kg)</label>
                      <div className="cum-input">
                        <Target size={15} className="cum-input-icon" />
                        <input
                          type="number"
                          required
                          inputMode="numeric"
                          placeholder="70"
                          value={formData.targetWeight}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              targetWeight: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="cum-actions">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn ghost"
                >
                  <ArrowLeft size={16} /> Back
                </button>
                <button type="submit" disabled={loading} className="btn">
                  {loading ? (
                    "Creating..."
                  ) : (
                    <>
                      <UserPlus size={16} /> Create patient
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
