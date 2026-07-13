import { Suspense } from "react";
import NewEventForm from "./NewEventForm";

export default function NewEventPage() {
  return (
    <div className="max-w-md mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold mb-8">New Event</h1>
      {/* NewEventForm reads useSearchParams (for the "Duplicate event"
          prefill) which requires a Suspense boundary in the app router. */}
      <Suspense fallback={null}>
        <NewEventForm />
      </Suspense>
    </div>
  );
}
