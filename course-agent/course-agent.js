export function mountCourseAgent(host, { lesson, getLocation, onNavigate }) {
  const controller = new AbortController();
  host.classList.add('course-agent');
  const heading = document.createElement('h2');
  heading.textContent = 'Course Agent';
  const note = document.createElement('p');
  note.textContent = 'Lesson guide prototype. No AI service is connected. Your responses are not sent anywhere.';
  const location = document.createElement('p');
  location.className = 'course-agent__location';
  const list = document.createElement('nav');
  list.setAttribute('aria-label', 'Course Agent lesson sections');
  const sections = [
    [lesson.id, 'Lesson Overview'],
    ...[...lesson.querySelectorAll('.article[id]')].map(article => [
      article.id, article.querySelector('.article__title')?.textContent.trim() || article.id,
    ]),
  ];
  for (const [id, title] of sections) {
    const link = document.createElement('a');
    link.href = `#${id}`;
    link.textContent = title;
    link.addEventListener('click', () => onNavigate(id), { signal: controller.signal });
    list.append(link);
  }
  host.replaceChildren(heading, note, location, list);
  function update() {
    const current = getLocation();
    location.textContent = `${current.lessonTitle} > ${current.sectionTitle}`;
    for (const link of list.querySelectorAll('a')) {
      if (link.hash === `#${current.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }
  update();
  return { update, destroy() { controller.abort(); host.replaceChildren(); } };
}
