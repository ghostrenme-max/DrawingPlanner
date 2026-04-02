import './BrandWordmark.css'

/** w + i(주황) + th + _ + w + o(틸) + rth → with_worth */
export default function BrandWordmark({ className = '' }) {
  return (
    <div className={`brand-mark ${className}`.trim()} aria-label="with worth">
      <span className="brand-mark-w">w</span>
      <span className="brand-mark-i">i</span>
      <span className="brand-mark-w">th</span>
      <span className="brand-mark-sep" aria-hidden>
        _
      </span>
      <span className="brand-mark-w">w</span>
      <span className="brand-mark-o">o</span>
      <span className="brand-mark-w">rth</span>
    </div>
  )
}
