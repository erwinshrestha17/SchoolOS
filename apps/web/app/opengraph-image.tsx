import { ImageResponse } from 'next/og';

export const alt =
  'SchoolOS — one connected place to run your school, with an illustrative school dashboard';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        padding: 54,
        background: '#f4f7fb',
        color: '#142c43',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: '100%',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 15,
            fontSize: 27,
            fontWeight: 700,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 43,
              height: 43,
              borderRadius: 10,
              color: '#fff',
              background: '#2563eb',
              fontSize: 27,
            }}
          >
            S
          </div>
          SchoolOS
        </div>
        <div style={{ display: 'flex', gap: 45, alignItems: 'flex-end' }}>
          <div
            style={{
              display: 'flex',
              flex: 1,
              flexDirection: 'column',
              gap: 26,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 67,
                fontWeight: 700,
                letterSpacing: -4,
                lineHeight: 1.07,
              }}
            >
              One connected place to run your school.
            </div>
            <div
              style={{
                display: 'flex',
                maxWidth: 600,
                color: '#586d80',
                fontSize: 23,
                lineHeight: 1.4,
              }}
            >
              Daily operations, attendance, academics, fees, and communication
              for Nepal schools.
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              width: 370,
              height: 320,
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid #d8e3ed',
              borderRadius: 14,
              background: '#fff',
              boxShadow: '0 22px 40px rgba(28, 55, 84, 0.12)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: 35,
                padding: '0 17px',
                background: '#edf2f7',
                color: '#7990a5',
                fontSize: 13,
              }}
            >
              <span>• • •</span>
              <span>Illustrative example data</span>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 22,
                padding: 26,
              }}
            >
              <div style={{ display: 'flex', fontSize: 17, fontWeight: 700 }}>
                School overview
              </div>
              <div
                style={{
                  display: 'flex',
                  padding: 17,
                  borderRadius: 8,
                  background: '#eff5fb',
                  color: '#355675',
                  fontSize: 14,
                }}
              >
                Attendance needs attention
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 13,
                  padding: 17,
                  border: '1px solid #e1eaf1',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              >
                <div style={{ display: 'flex', fontWeight: 700 }}>
                  Attendance overview
                </div>
                <div
                  style={{
                    display: 'flex',
                    height: 9,
                    borderRadius: 5,
                    background: '#e7eef5',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      width: '72%',
                      borderRadius: 5,
                      background: '#2563eb',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', color: '#718499' }}>
                  18 of 25 class registers submitted
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #d8e3ed',
            paddingTop: 19,
            color: '#667c90',
            fontSize: 17,
          }}
        >
          <span>Built for school operations in Nepal</span>
          <span style={{ color: '#2563eb', fontWeight: 700 }}>SchoolOS</span>
        </div>
      </div>
    </div>,
    size,
  );
}
