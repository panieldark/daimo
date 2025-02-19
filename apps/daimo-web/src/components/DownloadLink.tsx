"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { TextBold } from "./typography";
import { detectPlatform, downloadMetadata } from "../utils/platform";

export function DownloadLink() {
  return (
    <Link
      href={"/download"}
      target="_blank"
      className="px-9 py-5 bg-primaryLight rounded-lg"
    >
      <TextBold>Download</TextBold>
    </Link>
  );
}

export function DownloadLinkButton() {
  return (
    <Link
      href={"/download"}
      target="_blank"
      className="flex items-center space-x-2 lg:space-x-4 rounded-lg py-[15px] px-[36px] bg-primaryLight text-white font-semibold md:text-2xl tracking-tight whitespace-nowrap min-w-[240px] "
    >
      <div>Download</div>
      <Image
        src={"/assets/daimo-qr-download.png"}
        width={72}
        height={72}
        alt="QR Code"
      />
    </Link>
  );
}

export function DownloadLinkButtonMobileNav() {
  const [title, setTitle] = useState(downloadMetadata["ios"].title);

  useEffect(() => {
    if (detectPlatform(navigator.userAgent) === "android") {
      setTitle(downloadMetadata["android"].title);
    }
  }, []);

  return (
    <Link
      href={"/download"}
      target="_blank"
      className="flex items-center justify-center space-x-4 rounded-lg py-4 px-9 bg-primaryLight text-white font-bold md:text-lg tracking-snug"
    >
      <div>{title}</div>
    </Link>
  );
}
