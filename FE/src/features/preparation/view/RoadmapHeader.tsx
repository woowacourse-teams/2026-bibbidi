import { PageHeader } from "../../../components/page-header";
import { Breadcrumb } from "../../../components/breadcrumb";
import { RoadmapGameInvitation } from "./RoadmapGameInvitation";
import "./RoadmapHeader.css";

export function RoadmapHeader({
  categoryTitle,
  summary,
}: {
  categoryTitle?: string;
  summary: string;
}) {
  return (
    <PageHeader
      className="roadmap-header"
      titleId="preparation-roadmap-title"
      title={categoryTitle ?? "로드맵"}
      description={summary}
      actions={<RoadmapGameInvitation />}
      navigation={
        <Breadcrumb
          items={[
            { label: "로드맵" },
            ...(categoryTitle ? [{ label: categoryTitle }] : []),
          ]}
        />
      }
    />
  );
}
