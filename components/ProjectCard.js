export default function ProjectCard({ project }) {
	return (
		<article className="project-card">
			<div className="project-top-row">
				<h4>{project.title}</h4>
				{project.featured && <span className="badge">Featured</span>}
			</div>
			<p>{project.summary}</p>

			<div className="tech-row">
				{project.technologies.map((tech) => (
					<span key={`${project.title}-${tech}`}>{tech}</span>
				))}
			</div>

			<div className="project-links">
				{project.liveUrl && (
					<a href={project.liveUrl} target="_blank" rel="noreferrer">
						Live
					</a>
				)}
				{project.repoUrl && (
					<a href={project.repoUrl} target="_blank" rel="noreferrer">
						Source
					</a>
				)}
			</div>
		</article>
	);
}
