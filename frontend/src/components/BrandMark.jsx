import icon from '../assets/icon.jpg'

export function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="glass-strong flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl2">
        <img src={icon} alt="JudGO" className="h-full w-full object-cover" />
      </div>
      <div className="leading-tight">
        <div className="font-pixel text-[12px] tracking-[0.18em] text-frost-50">JudGO</div>
      </div>
    </div>
  )
}
