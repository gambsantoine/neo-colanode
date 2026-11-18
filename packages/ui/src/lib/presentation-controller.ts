// Lets the presenter window drive a running presentation.
export interface PresentationController {
  next: () => void;
  previous: () => void;
  goTo: (index: number) => void;
}
