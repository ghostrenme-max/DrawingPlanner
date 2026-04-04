import './BrandWordmark.css'

/** Dr + a(메인) + wing · Pl + a(서브) + nner — 스플래시 워드마크와 동일 패턴 */
export default function BrandWordmark({ className = '' }) {
  return (
    <div className={`brand-mark ${className}`.trim()} aria-label="Drawing Planner">
      <span className="brand-mark-w">Dr</span>
      <span className="brand-mark-i">a</span>
      <span className="brand-mark-w">wing </span>
      <span className="brand-mark-w">Pl</span>
      <span className="brand-mark-o">a</span>
      <span className="brand-mark-w">nner</span>
    </div>
  )
}
