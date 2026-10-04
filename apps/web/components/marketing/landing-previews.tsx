import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  Users,
  WalletCards,
} from 'lucide-react';
import styles from '../../app/landing.module.css';

export function DashboardPreview() {
  return (
    <div
      className={styles.previewFrame}
      aria-label="Illustrative product preview of a school leadership dashboard"
    >
      <div className={styles.previewTopline}>
        <span className={styles.previewWindowDots} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>
          Illustrative product preview <span aria-hidden="true">·</span> Example
          data
        </span>
        <span className={styles.previewToplineRight}>SchoolOS / Overview</span>
      </div>
      <div className={styles.previewApp}>
        <aside className={styles.previewSidebar} aria-hidden="true">
          <div className={styles.previewSchool}>
            <span className={styles.previewSchoolIcon}>E</span>
            <span>
              Example Secondary School<small>School workspace</small>
            </span>
          </div>
          <span className={styles.previewSideLabel}>WORKSPACE</span>
          <span className={styles.previewSideActive}>
            <LayoutDashboard size={15} /> Overview
          </span>
          <span>
            <Users size={15} /> Students
          </span>
          <span>
            <ClipboardCheck size={15} /> Attendance
          </span>
          <span>
            <GraduationCap size={15} /> Academics
          </span>
          <span>
            <WalletCards size={15} /> Fees
          </span>
          <span>
            <Megaphone size={15} /> Notices
          </span>
          <div className={styles.previewSidebarBottom}>
            <span className={styles.previewAvatar}>PA</span>
            <span>
              Principal Admin<small>School leadership</small>
            </span>
          </div>
        </aside>
        <div className={styles.previewContent}>
          <div className={styles.previewToolbar}>
            <span>School overview</span>
            <span>
              <CalendarDays size={13} /> Today
            </span>
          </div>
          <div className={styles.previewWelcome}>
            <div>
              <span className={styles.previewKicker}>MONDAY · SCHOOL DAY</span>
              <strong className={styles.previewGreeting}>
                Good morning, Principal.
              </strong>
              <p>Here is what needs your attention today.</p>
            </div>
            <span className={styles.previewStatus}>
              <span /> School day in progress
            </span>
          </div>
          <div className={styles.previewAttention}>
            <div className={styles.previewAttentionIcon}>
              <Bell size={17} />
            </div>
            <div>
              <strong>Needs attention</strong>
              <span>Two attendance registers are waiting for review.</span>
            </div>
            <ChevronRight size={17} />
          </div>
          <div className={styles.previewColumns}>
            <div className={styles.previewPanel}>
              <div className={styles.previewPanelHead}>
                <div>
                  <span className={styles.previewKicker}>TODAY</span>
                  <strong className={styles.previewPanelTitle}>
                    Attendance overview
                  </strong>
                </div>
                <span>
                  View register <ArrowUpRight size={13} />
                </span>
              </div>
              <div className={styles.previewProgress}>
                <span style={{ width: '72%' }} />
              </div>
              <div className={styles.previewProgressText}>
                <strong>18 of 25</strong> class registers submitted{' '}
                <span>72%</span>
              </div>
              <div className={styles.previewRow}>
                <span>
                  <i className={styles.previewRowDot} /> Grade 8 · Section A
                </span>
                <span className={styles.previewDone}>Submitted</span>
              </div>
              <div className={styles.previewRow}>
                <span>
                  <i className={styles.previewRowDot} /> Grade 9 · Section B
                </span>
                <span className={styles.previewDone}>Submitted</span>
              </div>
              <div className={styles.previewRow}>
                <span>
                  <i
                    className={`${styles.previewRowDot} ${styles.previewRowDotAmber}`}
                  />{' '}
                  Grade 10 · Section A
                </span>
                <span className={styles.previewPending}>Pending</span>
              </div>
            </div>
            <div className={styles.previewPanel}>
              <div className={styles.previewPanelHead}>
                <div>
                  <span className={styles.previewKicker}>UP NEXT</span>
                  <strong className={styles.previewPanelTitle}>
                    School activity
                  </strong>
                </div>
                <span>
                  View all <ArrowUpRight size={13} />
                </span>
              </div>
              <div className={styles.previewActivity}>
                <span className={styles.previewActivityIcon}>
                  <FileText size={15} />
                </span>
                <div>
                  <strong>Notice awaiting review</strong>
                  <small>Term schedule update · Draft</small>
                </div>
                <Clock3 size={14} />
              </div>
              <div className={styles.previewActivity}>
                <span className={styles.previewActivityIcon}>
                  <Users size={15} />
                </span>
                <div>
                  <strong>Admissions follow-up</strong>
                  <small>3 applications need a response</small>
                </div>
                <Clock3 size={14} />
              </div>
              <div className={styles.previewActivity}>
                <span className={styles.previewActivityIcon}>
                  <Check size={15} />
                </span>
                <div>
                  <strong>Fee collection posted</strong>
                  <small>Receipts ready for review</small>
                </div>
                <CheckCircle2 size={14} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TeacherPreview() {
  return (
    <div
      className={styles.teacherPreview}
      aria-label="Illustrative teacher workday preview"
    >
      <div className={styles.miniPreviewTop}>
        <span>Teacher today</span>
        <span>
          <CalendarDays size={14} /> Monday
        </span>
      </div>
      <div className={styles.teacherPreviewBody}>
        <span className={styles.previewKicker}>NEXT CLASS</span>
        <div className={styles.teacherClass}>
          <div>
            <strong>Mathematics</strong>
            <span>Grade 8 · Section A</span>
          </div>
          <span>09:10 – 09:55</span>
        </div>
        <span className={styles.miniButton}>
          Take attendance <ArrowRight size={15} />
        </span>
        <div className={styles.teacherSchedule}>
          <span className={styles.previewKicker}>TODAY&apos;S SCHEDULE</span>
          <div>
            <time>10:05</time>
            <span>Mathematics · Grade 9 B</span>
            <ChevronRight size={14} />
          </div>
          <div>
            <time>11:00</time>
            <span>Free period</span>
            <ChevronRight size={14} />
          </div>
        </div>
      </div>
      <span className={styles.previewCaption}>
        Illustrative preview · Example data
      </span>
    </div>
  );
}

export function ParentPreview() {
  return (
    <div
      className={styles.phone}
      aria-label="Illustrative parent mobile companion preview"
    >
      <div className={styles.phoneCamera} aria-hidden="true" />
      <div className={styles.phoneScreen}>
        <div className={styles.phoneTop}>
          <span>SchoolOS</span>
          <Bell size={17} />
        </div>
        <div className={styles.phoneGreeting}>
          <small>MONDAY · FAMILY VIEW</small>
          <strong>Good morning, Anu.</strong>
          <span>Updates for your linked child</span>
        </div>
        <div className={styles.phoneChild}>
          <span className={styles.phoneChildAvatar}>A</span>
          <div>
            <strong>Aarav Sharma</strong>
            <small>Grade 8 · Section A</small>
          </div>
          <ChevronRight size={16} />
        </div>
        <div className={styles.phoneSectionHead}>
          Today <span>View all</span>
        </div>
        <div className={styles.phoneUpdate}>
          <span className={styles.phoneUpdateIcon}>
            <ClipboardCheck size={17} />
          </span>
          <div>
            <strong>Attendance recorded</strong>
            <small>Present · Today</small>
          </div>
          <CheckCircle2 size={16} />
        </div>
        <div className={styles.phoneUpdate}>
          <span className={styles.phoneUpdateIcon}>
            <Megaphone size={17} />
          </span>
          <div>
            <strong>School notice</strong>
            <small>Term schedule update</small>
          </div>
          <ChevronRight size={16} />
        </div>
        <div className={styles.phoneBottom}>
          <span>
            <LayoutDashboard size={17} /> Home
          </span>
          <span>
            <BookOpen size={17} /> School
          </span>
          <span>
            <Bell size={17} /> Updates
          </span>
        </div>
      </div>
      <span className={styles.previewCaption}>
        Illustrative preview · Example data
      </span>
    </div>
  );
}
