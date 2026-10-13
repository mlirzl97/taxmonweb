import { AntMark } from "@/components/brand/ant-mark";

export default function AppLoading() {
  return (
    <main aria-label="Loading TaxMonWeb" className="app-route-loading">
      <div className="app-route-loading__mark" aria-hidden="true"><AntMark size={58} /></div>
      <p>Loading TaxMonWeb</p>
    </main>
  );
}
