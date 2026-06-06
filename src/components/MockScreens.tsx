/*
 * Placeholder "fake shop" screens — the structural stand-ins the prototype
 * renders behind the pin overlay. From M3 these are replaced by real full-page
 * screenshots loaded from Vercel Blob; the pin overlay stays identical.
 */
import type { CSSProperties, ReactNode, ReactElement } from "react";

export function Chrome({
  url,
  children,
}: {
  url?: string;
  children: ReactNode;
}) {
  return (
    <div className="chrome">
      <div className="chrome-bar">
        <span className="dot" style={{ background: "#E5685A" }} />
        <span className="dot" style={{ background: "#E8B73B" }} />
        <span className="dot" style={{ background: "#5BC07A" }} />
        <div className="chrome-url">{url || "example-shop.de"}</div>
      </div>
      <div className="chrome-body">{children}</div>
    </div>
  );
}

const ph = (h: number, w: string | number = "100%", r = 6): CSSProperties => ({
  height: h,
  width: w,
  borderRadius: r,
  background: "#E7E3D9",
});

function NavBar() {
  return (
    <div className="m-nav">
      <div className="m-logo" />
      <div className="m-navlinks">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="m-search" />
    </div>
  );
}

function HomeMock() {
  return (
    <div className="mock">
      <NavBar />
      <div className="m-hero">
        <div className="m-hero-img" />
        <div className="m-hero-copy">
          <div style={ph(20, "60%")} />
          <div style={{ ...ph(12, "85%"), marginTop: 10 }} />
          <div style={{ ...ph(12, "70%"), marginTop: 6 }} />
          <div className="m-btn-out" style={{ marginTop: 16 }} />
        </div>
      </div>
      <div className="m-cats">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="m-cat">
            <div className="m-cat-img" />
            <div style={{ ...ph(10, "70%"), margin: "8px auto 0" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PlpMock() {
  return (
    <div className="mock">
      <NavBar />
      <div className="m-plp">
        <div className="m-filter">
          <div style={ph(12, "60%")} />
          <div style={{ ...ph(28), marginTop: 10 }} />
          <div style={{ ...ph(28), marginTop: 8 }} />
          <div style={{ ...ph(28), marginTop: 8 }} />
        </div>
        <div className="m-grid">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="m-pcard">
              <div className="m-pcard-img" />
              <div style={{ ...ph(10, "80%"), marginTop: 8 }} />
              <div style={{ ...ph(10, "45%"), marginTop: 6 }} />
              <div className="m-btn-out sm" style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PdpMock() {
  return (
    <div className="mock">
      <NavBar />
      <div className="m-pdp">
        <div className="m-pdp-img" />
        <div className="m-pdp-info">
          <div style={ph(10, "30%")} />
          <div style={{ ...ph(20, "85%"), marginTop: 10 }} />
          <div style={{ ...ph(20, "55%"), marginTop: 6 }} />
          <div className="m-price" />
          <div className="m-variants">
            <span />
            <span />
            <span />
          </div>
          <div style={{ ...ph(12, "95%"), marginTop: 14 }} />
          <div style={{ ...ph(12, "88%"), marginTop: 6 }} />
          <div style={{ ...ph(12, "60%"), marginTop: 6 }} />
          <div className="m-btn-out lg" style={{ marginTop: 16 }} />
        </div>
      </div>
    </div>
  );
}

function CartMock() {
  return (
    <div className="mock">
      <NavBar />
      <div className="m-cart">
        <div className="m-cart-items">
          {[0, 1].map((i) => (
            <div key={i} className="m-line">
              <div className="m-line-img" />
              <div style={{ flex: 1 }}>
                <div style={ph(12, "70%")} />
                <div style={{ ...ph(10, "40%"), marginTop: 8 }} />
              </div>
              <div style={ph(14, 50)} />
            </div>
          ))}
          <div className="m-coupon" />
        </div>
        <div className="m-summary">
          <div style={ph(12, "50%")} />
          <div style={{ ...ph(10, "100%"), marginTop: 14 }} />
          <div style={{ ...ph(10, "100%"), marginTop: 8 }} />
          <div style={{ ...ph(16, "100%"), marginTop: 14 }} />
          <div className="m-btn-fill" style={{ marginTop: 14 }} />
        </div>
      </div>
    </div>
  );
}

function CheckoutMock() {
  return (
    <div className="mock">
      <NavBar />
      <div className="m-cart">
        <div className="m-cart-items">
          <div style={ph(14, "40%")} />
          <div style={{ ...ph(34), marginTop: 12 }} />
          <div style={{ ...ph(34), marginTop: 8 }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <div style={ph(34, "50%")} />
            <div style={ph(34, "50%")} />
          </div>
          <div style={{ ...ph(34), marginTop: 8 }} />
          <div style={{ ...ph(34), marginTop: 8 }} />
          <div style={{ ...ph(34), marginTop: 8 }} />
          <div className="m-btn-fill" style={{ marginTop: 14 }} />
        </div>
        <div className="m-summary">
          <div style={ph(12, "55%")} />
          <div className="m-express" />
          <div style={{ ...ph(10, "100%"), marginTop: 14 }} />
          <div style={{ ...ph(10, "100%"), marginTop: 8 }} />
          <div style={{ ...ph(16, "100%"), marginTop: 14 }} />
        </div>
      </div>
    </div>
  );
}

export const MOCK_SCREENS: Record<string, () => ReactElement> = {
  home: HomeMock,
  plp: PlpMock,
  pdp: PdpMock,
  cart: CartMock,
  checkout: CheckoutMock,
};
