const PARTICLES = Array.from({ length: 14 }, (_, index) => ({
  id: index,
  angle: index * (360 / 14),
  distance: 72 + (index % 4) * 14,
  delay: (index % 5) * 12,
  size: 4 + (index % 3) * 2,
}));

export function ParticleBurst({ revision, motion }) {
  if (!["up", "down", "reset"].includes(motion)) return null;

  return (
    <div
      key={`${revision}-${motion}`}
      className="particle-burst"
      data-motion={motion}
      aria-hidden="true"
    >
      {PARTICLES.map((particle) => (
        <span
          key={particle.id}
          className="particle"
          style={{
            "--particle-angle": `${particle.angle}deg`,
            "--particle-distance": `${particle.distance}px`,
            "--particle-delay": `${particle.delay}ms`,
            "--particle-size": `${particle.size}px`,
          }}
        />
      ))}
    </div>
  );
}
