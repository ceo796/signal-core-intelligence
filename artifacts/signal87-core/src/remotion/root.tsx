import { AbsoluteFill, Composition, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const card = {
  position: "absolute",
  width: 230,
  height: 310,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.92)",
  boxShadow: "0 32px 80px rgba(0,0,0,0.28)",
} as const;

function Signal87DocumentOrbit() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const orbit = frame * 1.15;
  const pulse = interpolate(Math.sin(frame / 12), [-1, 1], [0.88, 1.04]);

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        background: "#101312",
        color: "#f5f7f2",
        fontFamily: "Inter, system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -120,
          background:
            "radial-gradient(circle at 50% 42%, rgba(79,63,240,0.34), transparent 32%), radial-gradient(circle at 65% 58%, rgba(111,210,173,0.22), transparent 28%)",
        }}
      />
      <div
        style={{
          position: "relative",
          width: 1040,
          height: 560,
          perspective: 1200,
          transform: `scale(${interpolate(enter, [0, 1], [0.92, 1])})`,
        }}
      >
        <div
          style={{
            ...card,
            left: 250,
            top: 116,
            transform: `rotateX(58deg) rotateZ(${-16 + orbit / 80}deg) translateZ(30px)`,
          }}
        >
          <div style={{ margin: 26, height: 12, width: 120, borderRadius: 999, background: "#4f3ff0" }} />
          {[0, 1, 2, 3, 4].map((line) => (
            <div
              key={line}
              style={{
                marginLeft: 26,
                marginTop: 18,
                height: 10,
                width: 150 - line * 12,
                borderRadius: 999,
                background: "rgba(17,18,17,0.16)",
              }}
            />
          ))}
        </div>
        <div
          style={{
            ...card,
            left: 500,
            top: 92,
            transform: `rotateX(58deg) rotateZ(${14 - orbit / 100}deg) translateZ(92px)`,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, padding: 26 }}>
            {[90, 156, 118, 184, 132, 76].map((height, index) => (
              <span key={index} style={{ height, borderRadius: 10, background: "rgba(79,63,240,0.24)" }} />
            ))}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 410,
            top: 182,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: "#4f3ff0",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: 1.2,
            boxShadow: "0 42px 120px rgba(79,63,240,0.42)",
            transform: `scale(${pulse}) translateZ(140px)`,
          }}
        >
          Signal87
        </div>
        {["Source", "Cite", "Verify", "Reason"].map((label, index) => {
          const angle = orbit + index * 90;
          const x = Math.cos((angle * Math.PI) / 180) * 330 + 520;
          const y = Math.sin((angle * Math.PI) / 180) * 150 + 292;
          return (
            <div
              key={label}
              style={{
                position: "absolute",
                left: x - 72,
                top: y - 24,
                width: 144,
                height: 48,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.92)",
                color: "#18181b",
                fontSize: 18,
                fontWeight: 700,
                boxShadow: "0 18px 44px rgba(0,0,0,0.24)",
                opacity: interpolate(enter, [0, 1], [0, 1]),
              }}
            >
              {label}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 96, bottom: 72 }}>
        <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2 }}>Document intelligence</div>
        <div style={{ marginTop: 12, fontSize: 28, color: "rgba(245,247,242,0.72)" }}>
          Source-grounded answers, verified workflows, executive-ready output.
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function RemotionRoot() {
  return (
    <Composition
      id="Signal87DocumentOrbit"
      component={Signal87DocumentOrbit}
      durationInFrames={180}
      fps={30}
      width={1920}
      height={1080}
    />
  );
}
