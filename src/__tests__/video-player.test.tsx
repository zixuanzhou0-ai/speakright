import type React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VideoPlayer } from "@/components/phoneme/video-player";
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

    fireEvent.click(screen.getByRole("button", { name: /Animation/ }));
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
});
