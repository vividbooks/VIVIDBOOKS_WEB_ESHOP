function Group() {
  return (
    <div className="absolute left-[5.14px] size-[108.377px] top-[5.79px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 108.377 108.377">
        <g id="Group 21439">
          <circle cx="54.1885" cy="54.1885" fill="var(--fill-0, #FE5244)" id="Ellipse 4923" r="54.1885" />
          <circle cx="54.1885" cy="54.1885" fill="var(--fill-0, #FFA69F)" id="Ellipse 4924" r="43.9472" />
          <circle cx="54.1876" cy="54.1885" fill="var(--fill-0, #FEDFDC)" id="Ellipse 4925" r="32.6255" />
          <circle cx="54.1894" cy="54.1885" fill="var(--fill-0, #FFF2F1)" id="Ellipse 4926" r="22.9967" />
          <circle cx="54.1876" cy="54.1885" fill="var(--fill-0, white)" id="Ellipse 4927" r="12.0044" />
        </g>
      </svg>
    </div>
  );
}

function Group1() {
  return (
    <div className="absolute contents left-[5.14px] top-[5.79px]">
      <Group />
    </div>
  );
}

export default function Frame() {
  return (
    <div className="bg-[rgba(255,255,255,0)] relative size-full">
      <Group1 />
    </div>
  );
}