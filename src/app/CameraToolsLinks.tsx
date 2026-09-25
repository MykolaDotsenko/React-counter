import styles from "./AppearanceSwitcher.module.css";

const TOOLS = [
  ["Barcode scanner", "barcode-benchmark"],
  ["Visual camera", "visual-recognition-benchmark"],
  ["Shelf-price OCR", "shelf-label-ocr-tesseract-benchmark"],
] as const;

export function CameraToolsLinks() {
  return (
    <>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Camera tools</p>
          <h2>Scan & recognize</h2>
        </div>
        <span className={styles.current}>Experimental</span>
      </div>

      <div className={styles.toolOptions} aria-label="Camera and scanner tools">
        {TOOLS.map(([label, route]) => (
          <a
            key={route}
            className={styles.option}
            href={`${import.meta.env.BASE_URL}${route}/`}
            target="_blank"
            rel="noreferrer"
          >
            {label}
          </a>
        ))}
      </div>

      <p className={styles.hint}>
        Opens in a new tab. Manual price confirmation stays authoritative.
      </p>
    </>
  );
}
