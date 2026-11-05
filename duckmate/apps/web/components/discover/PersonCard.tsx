"use client";

/**
 * CardPerson → DuckCard (덕질 카드 1면). 사진은 DuckCard 규칙대로 카드 아래 스트립에만.
 */
import * as React from "react";
import { DuckCard, type DuckCardProps } from "@duckmate/ui";
import { ageBandLabel, toDuckCardHobbies } from "./format";
import type { CardPerson } from "./types";

export type PersonCardProps = Omit<DuckCardProps, "profileId" | "nickname" | "ageBand" | "region" | "verifyLevel" | "hobbies" | "favorite" | "nowInto" | "photos"> & {
  person: CardPerson;
  /** true 면 승인 사진 스트립을 카드 아래에 렌더 */
  showPhotos?: boolean;
};

export const PersonCard = React.forwardRef<HTMLDivElement, PersonCardProps>(({ person, showPhotos = false, ...rest }, ref) => (
  <DuckCard
    ref={ref}
    profileId={person.profileId}
    nickname={person.nickname}
    ageBand={ageBandLabel(person.ageBand)}
    region={person.region}
    verifyLevel={person.verifyLevel}
    hobbies={toDuckCardHobbies(person.hobbies)}
    favorite={person.favorite}
    nowInto={person.nowInto}
    photos={showPhotos ? person.photoUrls.map((src, i) => ({ src, alt: `${person.nickname} 사진 ${i + 1}` })) : undefined}
    {...rest}
  />
));
PersonCard.displayName = "PersonCard";
