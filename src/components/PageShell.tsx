export default function PageShell({
  title,
  sub,
  actions,
  children,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="top">
        <div>
          <h1>{title}</h1>
          {sub ? <div className="sub">{sub}</div> : null}
        </div>
        <div className="spacer" />
        {actions}
      </div>
      <div className="content">{children}</div>
    </>
  );
}
