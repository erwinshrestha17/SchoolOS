'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { filesToBase64Payloads } from '../../lib/files';

const today = new Date().toISOString().slice(0, 10);

export function ActivityFeedForm() {
  const queryClient = useQueryClient();
  const [post, setPost] = useState({
    classId: '',
    sectionId: '',
    title: 'Learning moment',
    caption: 'Students explored a hands-on classroom activity today.',
    category: 'LEARNING',
    studentIds: [] as string[],
  });
  const [files, setFiles] = useState<FileList | null>(null);
  const [moodLog, setMoodLog] = useState({
    classId: '',
    sectionId: '',
    studentId: '',
    mood: 'ENGAGED',
    note: '',
    logDate: today,
  });
  const [milestone, setMilestone] = useState({
    classId: '',
    sectionId: '',
    studentId: '',
    domain: 'Motor skills',
    milestone: 'Uses classroom materials independently',
    status: 'PROGRESSING',
    observationNote: '',
    photoUrl: '',
    observedAt: today,
  });
  const [milestoneFilters, setMilestoneFilters] = useState({
    studentId: '',
    month: today.slice(0, 7),
  });

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
  });
  const sectionsQuery = useQuery({
    queryKey: ['sections'],
    queryFn: api.listSections,
  });
  const studentsQuery = useQuery({
    queryKey: ['students'],
    queryFn: api.listStudents,
  });
  const postsQuery = useQuery({
    queryKey: ['activity-posts'],
    queryFn: api.listActivityPosts,
  });
  const moodLogsQuery = useQuery({
    queryKey: ['mood-logs'],
    queryFn: api.listMoodLogs,
  });
  const milestonesQuery = useQuery({
    queryKey: ['developmental-milestones', milestoneFilters],
    queryFn: () =>
      api.listDevelopmentalMilestones({
        studentId: milestoneFilters.studentId || null,
        month: milestoneFilters.month || null,
      }),
  });
  const deliveriesQuery = useQuery({
    queryKey: ['notification-deliveries'],
    queryFn: api.listNotificationDeliveries,
  });

  useEffect(() => {
    const firstClass = classesQuery.data?.[0];

    if (firstClass) {
      setPost((current) => (current.classId ? current : { ...current, classId: firstClass.id }));
      setMoodLog((current) => (current.classId ? current : { ...current, classId: firstClass.id }));
      setMilestone((current) =>
        current.classId ? current : { ...current, classId: firstClass.id },
      );
    }
  }, [classesQuery.data]);

  const postSections = (sectionsQuery.data ?? []).filter((section) => {
    const sectionClassId = section.classId ?? section.class?.id;
    return !post.classId || sectionClassId === post.classId;
  });
  const moodSections = (sectionsQuery.data ?? []).filter((section) => {
    const sectionClassId = section.classId ?? section.class?.id;
    return !moodLog.classId || sectionClassId === moodLog.classId;
  });
  const classStudents = (studentsQuery.data ?? []).filter((student) => {
    return !post.classId || student.class?.id === post.classId;
  });
  const moodStudents = (studentsQuery.data ?? []).filter((student) => {
    return !moodLog.classId || student.class?.id === moodLog.classId;
  });
  const milestoneSections = (sectionsQuery.data ?? []).filter((section) => {
    const sectionClassId = section.classId ?? section.class?.id;
    return !milestone.classId || sectionClassId === milestone.classId;
  });
  const milestoneStudents = (studentsQuery.data ?? []).filter((student) => {
    return !milestone.classId || student.class?.id === milestone.classId;
  });

  const postMutation = useMutation({
    mutationFn: api.createActivityPost,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['activity-posts'] });
      void queryClient.invalidateQueries({ queryKey: ['notification-deliveries'] });
      setFiles(null);
      setPost((current) => ({ ...current, studentIds: [] }));
    },
  });
  const moodMutation = useMutation({
    mutationFn: api.createMoodLog,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['mood-logs'] }),
  });
  const reactionMutation = useMutation({
    mutationFn: ({ postId, reaction, guardianId, studentId }: {
      postId: string;
      reaction: string;
      guardianId?: string;
      studentId?: string;
    }) =>
      api.createActivityReaction(postId, {
        reaction,
        guardianId,
        studentId,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['activity-posts'] }),
  });
  const milestoneMutation = useMutation({
    mutationFn: api.createDevelopmentalMilestone,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['developmental-milestones'] }),
  });

  async function createPost() {
    if (!files || files.length === 0 || files.length > 5) {
      return;
    }

    const attachments = await filesToBase64Payloads(files);
    postMutation.mutate({
      ...post,
      sectionId: post.sectionId || null,
      audienceType: post.studentIds.length > 0 ? 'SECTION' : post.sectionId ? 'SECTION' : 'CLASS',
      attachments,
    });
  }

  function toggleStudent(studentId: string) {
    setPost((current) => ({
      ...current,
      studentIds: current.studentIds.includes(studentId)
        ? current.studentIds.filter((id) => id !== studentId)
        : [...current.studentIds, studentId],
    }));
  }

  const activityDeliveries = (deliveriesQuery.data ?? []).filter(
    (delivery) => delivery.sourceType === 'activity_post',
  );

  function findReactionActor(postStudentIds: string[]) {
    const taggedStudent = (studentsQuery.data ?? []).find((student) =>
      postStudentIds.includes(student.id),
    );
    const fallbackStudent = taggedStudent ?? studentsQuery.data?.[0];
    const guardianId = fallbackStudent?.guardians?.[0]?.id;

    return {
      guardianId,
      studentId: guardianId ? undefined : fallbackStudent?.id,
    };
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Activity Composer</p>
          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={post.classId}
                onChange={(event) =>
                  setPost((current) => ({ ...current, classId: event.target.value, sectionId: '', studentIds: [] }))
                }
              >
                <option value="">Class</option>
                {(classesQuery.data ?? []).map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name}
                  </option>
                ))}
              </select>
              <select
                value={post.sectionId}
                onChange={(event) =>
                  setPost((current) => ({ ...current, sectionId: event.target.value }))
                }
              >
                <option value="">Whole class</option>
                {postSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={post.title}
              onChange={(event) => setPost((current) => ({ ...current, title: event.target.value }))}
              placeholder="Post title"
            />
            <textarea
              rows={4}
              value={post.caption}
              onChange={(event) => setPost((current) => ({ ...current, caption: event.target.value }))}
              placeholder="Caption"
            />
            <div className="grid gap-3 md:grid-cols-[220px_1fr]">
              <select
                value={post.category}
                onChange={(event) => setPost((current) => ({ ...current, category: event.target.value }))}
              >
                <option value="LEARNING">Learning</option>
                <option value="OUTDOOR_PLAY">Outdoor play</option>
                <option value="ART_AND_CRAFT">Art and craft</option>
                <option value="CELEBRATION">Celebration</option>
                <option value="SPORTS">Sports</option>
                <option value="GENERAL">General</option>
              </select>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => setFiles(event.target.files)}
              />
            </div>

            <div className="rounded-3xl border border-[var(--line)] bg-white/55 p-4">
              <p className="label mb-3">Specific student tags</p>
              <div className="flex flex-wrap gap-2">
                {classStudents.length > 0 ? (
                  classStudents.map((student) => {
                    const selected = post.studentIds.includes(student.id);
                    const name =
                      student.fullNameEn ??
                      `${student.firstNameEn ?? ''} ${student.lastNameEn ?? ''}`.trim() ??
                      student.studentSystemId;

                    return (
                      <button
                        key={student.id}
                        type="button"
                        className={`rounded-full border px-3 py-2 text-xs ${
                          selected
                            ? 'border-[var(--teal)] bg-[var(--teal)] text-white'
                            : 'border-[var(--line)]'
                        }`}
                        onClick={() => toggleStudent(student.id)}
                      >
                        {name}
                      </button>
                    );
                  })
                ) : (
                  <span className="text-sm text-[var(--muted)]">No students in this class yet.</span>
                )}
              </div>
            </div>

            <button
              className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!post.classId || !files || files.length === 0 || files.length > 5 || postMutation.isPending}
              onClick={() => void createPost()}
            >
              {postMutation.isPending ? 'Publishing...' : 'Publish activity post'}
            </button>
            {files && files.length > 5 ? (
              <p className="text-sm text-[var(--accent-dark)]">Please attach 1 to 5 photos.</p>
            ) : null}
          </div>
        </section>

        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Daily Mood Log</p>
          <div className="grid gap-3">
            <select
              value={moodLog.classId}
              onChange={(event) =>
                setMoodLog((current) => ({ ...current, classId: event.target.value, sectionId: '', studentId: '' }))
              }
            >
              <option value="">Class</option>
              {(classesQuery.data ?? []).map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </option>
              ))}
            </select>
            <select
              value={moodLog.sectionId}
              onChange={(event) => setMoodLog((current) => ({ ...current, sectionId: event.target.value }))}
            >
              <option value="">Whole class</option>
              {moodSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
            <select
              value={moodLog.studentId}
              onChange={(event) => setMoodLog((current) => ({ ...current, studentId: event.target.value }))}
            >
              <option value="">Class mood</option>
              {moodStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullNameEn ?? `${student.firstNameEn ?? ''} ${student.lastNameEn ?? ''}`.trim()}
                </option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={moodLog.mood}
                onChange={(event) => setMoodLog((current) => ({ ...current, mood: event.target.value }))}
              >
                <option value="CALM">Calm</option>
                <option value="ENGAGED">Engaged</option>
                <option value="EXCITED">Excited</option>
                <option value="UNSETTLED">Unsettled</option>
                <option value="TIRED">Tired</option>
              </select>
              <input
                type="date"
                value={moodLog.logDate}
                onChange={(event) => setMoodLog((current) => ({ ...current, logDate: event.target.value }))}
              />
            </div>
            <textarea
              rows={4}
              value={moodLog.note}
              onChange={(event) => setMoodLog((current) => ({ ...current, note: event.target.value }))}
              placeholder="Optional note"
            />
            <button
              className="rounded-2xl bg-[var(--teal)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!moodLog.classId || moodMutation.isPending}
              onClick={() =>
                moodMutation.mutate({
                  ...moodLog,
                  sectionId: moodLog.sectionId || null,
                  studentId: moodLog.studentId || null,
                  logDate: new Date(moodLog.logDate).toISOString(),
                })
              }
            >
              {moodMutation.isPending ? 'Saving...' : 'Save mood log'}
            </button>
          </div>
        </section>
      </div>

      <section className="shell-card rounded-[28px] p-6">
        <p className="label mb-4">Developmental Milestone</p>
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={milestone.classId}
                onChange={(event) =>
                  setMilestone((current) => ({
                    ...current,
                    classId: event.target.value,
                    sectionId: '',
                    studentId: '',
                  }))
                }
              >
                <option value="">Class</option>
                {(classesQuery.data ?? []).map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name}
                  </option>
                ))}
              </select>
              <select
                value={milestone.sectionId}
                onChange={(event) =>
                  setMilestone((current) => ({ ...current, sectionId: event.target.value }))
                }
              >
                <option value="">Whole class</option>
                {milestoneSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={milestone.studentId}
              onChange={(event) =>
                setMilestone((current) => ({ ...current, studentId: event.target.value }))
              }
            >
              <option value="">Select child</option>
              {milestoneStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullNameEn ?? `${student.firstNameEn ?? ''} ${student.lastNameEn ?? ''}`.trim()}
                </option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={milestone.domain}
                onChange={(event) =>
                  setMilestone((current) => ({ ...current, domain: event.target.value }))
                }
                placeholder="Domain"
              />
              <select
                value={milestone.status}
                onChange={(event) =>
                  setMilestone((current) => ({ ...current, status: event.target.value }))
                }
              >
                <option value="EMERGING">Emerging</option>
                <option value="PROGRESSING">Progressing</option>
                <option value="ACHIEVED">Achieved</option>
                <option value="NEEDS_SUPPORT">Needs support</option>
              </select>
            </div>
            <input
              value={milestone.milestone}
              onChange={(event) =>
                setMilestone((current) => ({ ...current, milestone: event.target.value }))
              }
              placeholder="Milestone"
            />
            <textarea
              rows={3}
              value={milestone.observationNote}
              onChange={(event) =>
                setMilestone((current) => ({ ...current, observationNote: event.target.value }))
              }
              placeholder="Observation note"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={milestone.photoUrl}
                onChange={(event) =>
                  setMilestone((current) => ({ ...current, photoUrl: event.target.value }))
                }
                placeholder="Optional photo URL"
              />
              <input
                type="date"
                value={milestone.observedAt}
                onChange={(event) =>
                  setMilestone((current) => ({ ...current, observedAt: event.target.value }))
                }
              />
            </div>
            <button
              className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!milestone.classId || !milestone.studentId || milestoneMutation.isPending}
              onClick={() =>
                milestoneMutation.mutate({
                  ...milestone,
                  sectionId: milestone.sectionId || null,
                  observationNote: milestone.observationNote || null,
                  photoUrl: milestone.photoUrl || null,
                  observedAt: new Date(milestone.observedAt).toISOString(),
                })
              }
            >
              {milestoneMutation.isPending ? 'Saving...' : 'Save milestone'}
            </button>
          </div>

          <div className="rounded-3xl border border-[var(--line)] bg-white/55 p-4">
            <p className="font-semibold">Archive filters</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <select
                value={milestoneFilters.studentId}
                onChange={(event) =>
                  setMilestoneFilters((current) => ({
                    ...current,
                    studentId: event.target.value,
                  }))
                }
              >
                <option value="">All children</option>
                {(studentsQuery.data ?? []).map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullNameEn ?? `${student.firstNameEn ?? ''} ${student.lastNameEn ?? ''}`.trim()}
                  </option>
                ))}
              </select>
              <input
                type="month"
                value={milestoneFilters.month}
                onChange={(event) =>
                  setMilestoneFilters((current) => ({
                    ...current,
                    month: event.target.value,
                  }))
                }
              />
            </div>
            <div className="mt-4 grid gap-3">
              {(milestonesQuery.data ?? []).slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
                  <p className="font-semibold">{item.milestone}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {item.domain} / {item.status} /{' '}
                    {new Date(item.observedAt).toLocaleDateString()}
                  </p>
                  {item.observationNote ? (
                    <p className="mt-2 text-sm text-[var(--muted)]">{item.observationNote}</p>
                  ) : null}
                </div>
              ))}
              {milestonesQuery.data?.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No milestones for this filter yet.</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Recent Posts</p>
          <div className="grid gap-3">
            {(postsQuery.data ?? []).slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-2xl border border-[var(--line)] bg-white/55 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {item.category} / {item.audienceType}
                    </p>
                  </div>
                  <p className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
                    {item.attachments.length} photos
                  </p>
                </div>
                <p className="mt-3 text-sm text-[var(--muted)]">{item.caption ?? item.body}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.attachments.map((attachment) => (
                    <span
                      key={attachment.id}
                      className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]"
                    >
                      {attachment.fileName}
                    </span>
                  ))}
                </div>
                {item.studentTags.length > 0 ? (
                  <p className="mt-3 text-sm text-[var(--muted)]">
                    Tagged:{' '}
                    {item.studentTags
                      .map((tag) =>
                        tag.student
                          ? `${tag.student.firstNameEn} ${tag.student.lastNameEn}`.trim()
                          : tag.studentId,
                      )
                      .join(', ')}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {(['HEART', 'CLAP', 'STAR'] as const).map((reaction) => {
                    const count =
                      item.reactions?.filter((entry) => entry.reaction === reaction).length ?? 0;
                    const actor = findReactionActor(
                      item.studentTags.map((tag) => tag.studentId),
                    );

                    return (
                      <button
                        key={reaction}
                        type="button"
                        className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-semibold disabled:opacity-50"
                        disabled={!actor.guardianId && !actor.studentId}
                        onClick={() =>
                          reactionMutation.mutate({
                            postId: item.id,
                            reaction,
                            guardianId: actor.guardianId,
                            studentId: actor.studentId,
                          })
                        }
                      >
                        {reaction.toLowerCase()} {count}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {postsQuery.data?.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No activity posts yet.</p>
            ) : null}
          </div>
        </section>
        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Mood History</p>
          <div className="grid gap-3">
            {(moodLogsQuery.data ?? []).slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-2xl border border-[var(--line)] bg-white/55 p-4">
                <p className="font-semibold">
                  {item.mood}
                  {item.student
                    ? ` / ${item.student.firstNameEn} ${item.student.lastNameEn}`
                    : ' / Class mood'}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {new Date(item.logDate).toLocaleDateString()}
                  {item.note ? ` / ${item.note}` : ''}
                </p>
              </div>
            ))}
            {moodLogsQuery.data?.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No mood logs yet.</p>
            ) : null}
          </div>
        </section>
      </div>

      <section className="shell-card rounded-[28px] p-6">
        <p className="label mb-4">Activity Delivery Records</p>
        <div className="grid gap-3 md:grid-cols-2">
          {activityDeliveries.slice(0, 6).map((delivery) => (
            <div key={delivery.id} className="rounded-2xl border border-[var(--line)] bg-white/55 p-4">
              <p className="font-semibold">{delivery.title}</p>
              <p className="text-sm text-[var(--muted)]">
                {delivery.channel} / {delivery.status} / {delivery.destination ?? 'no destination'}
              </p>
            </div>
          ))}
          {activityDeliveries.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No activity delivery records yet.</p>
          ) : null}
        </div>
      </section>

      {[postMutation, moodMutation, reactionMutation, milestoneMutation].map((mutationState, index) =>
        mutationState.isError ? (
          <p key={index} className="text-sm text-[var(--accent-dark)]">
            {mutationState.error.message}
          </p>
        ) : null,
      )}
    </div>
  );
}
