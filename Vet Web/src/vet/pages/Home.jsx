
import React from "react";
import "./Home.css";

function Home() {
  const comingSoon = (feature) => {
    alert(`${feature} will be available soon!`);
  };

  return (
    <div className="pawrescue">

      {/* NAVIGATION */}
      <nav className="navbar">
        <a href="/" className="logo">
          <span className="logo-icon">🐾</span>
          PawRescue
        </a>

        <div className="nav-actions">
          <button
            className="donate-btn"
            onClick={() => comingSoon("Donations")}
          >
            Donate Now
          </button>

          <button
            className="login-btn"
            onClick={() => comingSoon("Sign In / Sign Up")}
          >
            Sign In / Sign Up
          </button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <main className="hero">

        <div className="hero-content">
          <span className="eyebrow">
            EVERY LIFE DESERVES A CHANCE
          </span>

          <h1>
            Be Their Voice.
            <br />
            <span>Save Their Life.</span>
          </h1>

          <p className="hero-description">
            Every injured animal deserves care, compassion,
            and a chance to live. Help us connect animals in
            need with people who can make a difference.
          </p>

          <button
            className="report-btn"
            onClick={() => comingSoon("Animal Reporting")}
          >
            🐾 Report an Injured Animal
            <span> → </span>
          </button>

          <p className="hero-note">
            Your report could be the beginning of a rescue.
          </p>
        </div>

        {/* ANIMAL PHOTOGRAPHS */}
        <div className="animal-gallery">

          <div className="animal-photo photo-one">
            <img
              src="https://images.unsplash.com/photo-1552053831-71594a27632d?w=700"
              alt="Golden retriever"
            />
          </div>

          <div className="animal-photo photo-two">
            <img
              src="https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=700"
              alt="Cat looking at the camera"
            />
          </div>

          <div className="animal-photo photo-three">
            <img
              src="https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=700"
              alt="Dog outdoors"
            />
          </div>

          <div className="animal-photo photo-four">
            <img
              src="https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=700"
              alt="Happy dog"
            />
          </div>

          <div className="gallery-decoration">
            <span>♥</span>
            Compassion in action
          </div>

        </div>
      </main>

      {/* BOTTOM MESSAGE */}
      <section className="mission">
        <h2>Small acts. Second chances. Saved lives.</h2>
        <p>
          Together, we can build a safer world for animals.
        </p>
      </section>

      <footer>
        <p>© 2026 PawRescue. Every life matters. 🐾</p>
      </footer>

    </div>
  );
}

export default Home;
