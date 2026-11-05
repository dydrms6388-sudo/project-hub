import { LinkButton } from "@/components/LinkButton";
import { Container } from "@/components/Container";

export const metadata = { title: "페이지를 찾을 수 없어요", robots: { index: false } };

export default function NotFound() {
  return (
    <Container className="py-24 text-center">
      <p className="text-label text-primary">404</p>
      <h1 className="text-h1 mt-2">페이지를 찾을 수 없어요</h1>
      <p className="text-body mt-3 text-muted-foreground">주소가 바뀌었거나 아직 준비 중인 페이지예요.</p>
      <LinkButton href="/" className="mt-8">
        홈으로
      </LinkButton>
    </Container>
  );
}
