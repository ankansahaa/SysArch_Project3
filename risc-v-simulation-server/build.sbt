name := "simulator-server"
organization := "saarland.sic.sysarch"
version := "1.0"

lazy val root = (project in file(".")).enablePlugins(PlayScala)

scalaVersion := "2.13.15"

libraryDependencies += guice
libraryDependencies += "org.apache.pekko" %% "pekko-actor-typed" % "1.0.2"
libraryDependencies += "org.apache.pekko" %% "pekko-actor" % "1.0.2"
libraryDependencies += "org.apache.pekko" %% "pekko-stream" % "1.0.2"
libraryDependencies += "org.apache.pekko" %% "pekko-slf4j" % "1.0.2"
libraryDependencies += "org.apache.pekko" %% "pekko-serialization-jackson" % "1.0.2"
libraryDependencies += "org.scalatestplus.play" %% "scalatestplus-play" % "7.0.2" % Test

// No Twirl templates — frontend is served by the React dev server or a CDN
Compile / doc / sources := Seq.empty
Compile / packageDoc / publishArtifact := false
