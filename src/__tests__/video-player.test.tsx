import type React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VideoPlayer } from "@/components/phoneme/video-player";
import { getTeachingVideosForSoundUnit } from "@/lib/language-teaching-videos";
import { getSpanishSoundVideoSet } from "@/lib/spanish-sounds-of-speech-videos";

vi.mock("@/components/common/desktop-external-link", () => ({
  DesktopExternalLink: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("VideoPlayer", () => {
  it("renders available local video without visible source authorization text", () => {
    render(
      <VideoPlayer
        slug="es-a"
        available
        localSrc="/videos/language-assets/es-ES/animation/es-a.mp4"
        source="University of Iowa Sounds of Speech Spanish"
        sourceUrl="https://soundsofspeech.uiowa.edu/"
        license="CC test license"
        attribution="Long attribution should not be visible here"
        notes={[
          "User stated authorization to bundle these official website resources locally on 2026-06-08.",
          "The MP4 includes an AAC track.",
        ]}
      />,
    );

    const video = document.querySelector("video");
    expect(video).toBeTruthy();
    expect(video).toHaveAttribute(
      "src",
      "/videos/language-assets/es-ES/animation/es-a.mp4",
    );
    expect(
      screen.queryByText(/University of Iowa Sounds of Speech Spanish/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/User stated authorization/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Long attribution/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/CC test license/i)).not.toBeInTheDocument();
  });

  it("renders Spanish target sound video by default", () => {
    render(
      <VideoPlayer
        slug="es-a"
        available
        localSrc="/videos/language-assets/es-ES/animation/es-a.mp4"
        spanishVideoSet={getSpanishSoundVideoSet("es-a")}
      />,
    );

    expect(document.querySelector("video")).toHaveAttribute(
      "src",
      "/videos/language-assets/es-ES/examples/es-a/sound.mp4",
    );
    const video = document.querySelector("video");
    expect(video).not.toHaveClass("aspect-video");
    expect(video).toHaveClass("w-[min(100%,370px)]");
  });

  it("switches Spanish video between animation and official example clips", () => {
    render(
      <VideoPlayer
        slug="es-a"
        available
        localSrc="/videos/language-assets/es-ES/animation/es-a.mp4"
        spanishVideoSet={getSpanishSoundVideoSet("es-a")}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /动画/ }));
    expect(document.querySelector("video")).toHaveAttribute(
      "src",
      "/videos/language-assets/es-ES/animation/es-a.mp4",
    );

    fireEvent.click(screen.getByRole("button", { name: /arma/ }));
    expect(document.querySelector("video")).toHaveAttribute(
      "src",
      "/videos/language-assets/es-ES/examples/es-a/arma.mp4",
    );
  });

  it("switches Spanish videos with previous and next controls", () => {
    render(
      <VideoPlayer
        slug="es-a"
        available
        localSrc="/videos/language-assets/es-ES/animation/es-a.mp4"
        spanishVideoSet={getSpanishSoundVideoSet("es-a")}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /下一个西语视频/ }));
    expect(document.querySelector("video")).toHaveAttribute(
      "src",
      "/videos/language-assets/es-ES/examples/es-a/arma.mp4",
    );

    fireEvent.click(screen.getByRole("button", { name: /上一个西语视频/ }));
    expect(document.querySelector("video")).toHaveAttribute(
      "src",
      "/videos/language-assets/es-ES/examples/es-a/sound.mp4",
    );
  });

  it("keeps external fallback resources visible when no local video is available", () => {
    render(
      <VideoPlayer
        slug="es-lexical-stress"
        available={false}
        resources={[
          {
            title: "External Spanish pronunciation resource",
            url: "https://example.com/spanish",
            kind: "ipa",
          },
        ]}
      />,
    );

    expect(screen.getByText("外部 IPA / 发音教学资源")).toBeInTheDocument();
    expect(
      screen.getByText("External Spanish pronunciation resource"),
    ).toBeInTheDocument();
  });

  it("uses local teaching lessons instead of external fallback cards for rule units", () => {
    render(
      <VideoPlayer
        slug="fr-liaison"
        available={false}
        resources={[
          {
            title: "External French resource",
            url: "https://example.com/french",
            kind: "ipa",
          },
        ]}
        teachingVideos={getTeachingVideosForSoundUnit("fr-FR", "fr-liaison")}
      />,
    );

    expect(document.querySelector("video")).toHaveAttribute(
      "src",
      "/videos/language-assets/fr-FR/youtube-lessons/yRCD8vgohZo.mp4",
    );
    expect(screen.getByText("教学讲解")).toBeInTheDocument();
    expect(screen.queryByText("外部 IPA / 发音教学资源")).not.toBeInTheDocument();
    expect(screen.queryByText("External French resource")).not.toBeInTheDocument();
  });

  it("lets non-Spanish local language videos switch to a local teaching lesson", () => {
    render(
      <VideoPlayer
        slug="fr-i"
        available
        label="Phonétique.ca 本地法语口型/舌位视频"
        localSrc="/videos/language-assets/fr-FR/articulation/fr-i.mp4"
        teachingVideos={getTeachingVideosForSoundUnit("fr-FR", "fr-i")}
      />,
    );

    expect(document.querySelector("video")).toHaveAttribute(
      "src",
      "/videos/language-assets/fr-FR/articulation/fr-i.mp4",
    );

    fireEvent.click(screen.getByRole("button", { name: /教学讲解/ }));
    expect(document.querySelector("video")).toHaveAttribute(
      "src",
      "/videos/language-assets/fr-FR/youtube-lessons/Ihh8xoLXrrU.mp4",
    );
  });

  it("lets local video selector labels wrap instead of truncating", () => {
    render(
      <VideoPlayer
        slug="fr-i"
        available
        label="Phonétique.ca 本地法语口型/舌位视频"
        localSrc="/videos/language-assets/fr-FR/articulation/fr-i.mp4"
        teachingVideos={getTeachingVideosForSoundUnit("fr-FR", "fr-i")}
      />,
    );

    const selectorButton = screen.getByRole("button", { name: /教学讲解/ });
    const label = selectorButton.querySelector("span");

    expect(selectorButton).not.toHaveClass("h-7");
    expect(label).not.toHaveClass("truncate");
    expect(label).toHaveClass("break-words");
    expect(label).toHaveClass("text-center");
  });

  it("sizes non-Spanish local language videos without forcing 16:9", () => {
    render(
      <VideoPlayer
        slug="fr-i"
        available
        localSrc="/videos/language-assets/fr-FR/articulation/fr-i.mp4"
      />,
    );

    const video = document.querySelector("video");
    expect(video).not.toHaveClass("aspect-video");
    expect(video).toHaveClass("w-[min(100%,360px)]");
  });
});
