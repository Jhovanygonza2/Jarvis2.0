import React from "react";
import { frameworksData } from "./FrameworksData";
import "./App.css";

const FrameworksView = ({ onBack }) => {
  return (
    <div className="fw-container">
      <header className="fw-header">
        <div className="fw-header-content">
          <button className="fw-back-btn" onClick={onBack}>
            <span className="fw-back-arrow">←</span> VOLVER AL HUD
          </button>
          <h2 className="fw-title">MÓDULOS DE INTELIGENCIA</h2>
          <p className="fw-subtitle">LIBRERÍAS Y FRAMEWORKS PARA LA EVOLUCIÓN DE J.A.R.V.I.S.</p>
        </div>
        <div className="fw-header-line" />
      </header>

      <div className="fw-grid">
        {frameworksData.map((fw) => (
          <div key={fw.id} className="fw-card">
            <div className="fw-card-glow" />
            <div className="fw-card-content">
              <div className="fw-card-top">
                <span className="fw-card-icon">{fw.icon}</span>
                <span className="fw-card-category">{fw.category.toUpperCase()}</span>
              </div>
              <h3 className="fw-card-name">{fw.name}</h3>
              <p className="fw-card-desc">{fw.description}</p>

              <div className="fw-card-section">
                <span className="fw-section-label">CARACTERÍSTICAS</span>
                <ul className="fw-list">
                  {fw.features.map((feat, i) => (
                    <li key={i}>{feat}</li>
                  ))}
                </ul>
              </div>

              <div className="fw-card-section">
                <span className="fw-section-label">CASOS DE USO</span>
                <div className="fw-tags">
                  {fw.uses.map((use, i) => (
                    <span key={i} className="fw-tag">{use}</span>
                  ))}
                </div>
              </div>

              <a href={fw.link} target="_blank" rel="noopener noreferrer" className="fw-link-btn">
                EXPLORAR DOCUMENTACIÓN <span className="fw-link-arrow">↗</span>
              </a>
            </div>
            <div className="fw-card-border" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default FrameworksView;
