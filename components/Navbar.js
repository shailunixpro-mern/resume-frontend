export default function Navbar({ name }) {
	return (
		<header>
			<nav className="top-nav">
				<a href="#" className="brand">
					{name}
				</a>
				<div className="links">
					<a href="#skills">Skills</a>
					<a href="#projects">Projects</a>
				</div>
			</nav>
		</header>
	);
}
