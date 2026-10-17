import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import InstallApp from "./InstallApp";
test("uses a browser install prompt once and hides after installation", async () => {
  render(<InstallApp />);
  const event = new Event("beforeinstallprompt", { cancelable: true });
  event.prompt = jest.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: "accepted" });
  act(() => window.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Instalar Jarvis" }));
  await waitFor(() => expect(event.prompt).toHaveBeenCalledTimes(1));
  act(() => window.dispatchEvent(new Event("appinstalled")));
  expect(screen.queryByLabelText("Instalar Jarvis")).not.toBeInTheDocument();
});
test("shows manual instructions without installation support", () => {
  render(<InstallApp />);
  expect(screen.getByText(/Abre el menú/)).toBeInTheDocument();
});
