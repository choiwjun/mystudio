"use client";

type HqProfileSetupModalProps = {
  readonly onClose: () => void;
};

export function HqProfileSetupModal({ onClose }: HqProfileSetupModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="hq-profile-setup-title"
        aria-modal="true"
        className="modal-panel"
        role="dialog"
      >
        <div>
          <h2 id="hq-profile-setup-title">회사 프로필 설정이 필요합니다</h2>
          <p className="muted">
            회사명과 집중 카테고리를 저장한 뒤 Hermes 스캔과 콘텐츠 선택을 진행할 수 있습니다.
          </p>
        </div>
        <div className="button-row compact-actions">
          <a className="button primary" href="/settings">
            설정하기
          </a>
          <button className="button" onClick={onClose} type="button">
            닫기
          </button>
        </div>
      </section>
    </div>
  );
}
